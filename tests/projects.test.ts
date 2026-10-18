import { describe, expect, it } from "vitest";
import type { BusinessBrief } from "@/lib/generation";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";
import {
  ProjectCollectionSchema,
  ProjectCollectionV1Schema,
  ProjectCollectionV2Schema,
  ProjectRecordSchema,
  ProjectStorageError,
  createProjectStorage,
  pageFromProject,
  projectSnapshotFromPage,
  type ProjectStorageLike,
} from "@/lib/projects";

class MemoryStorage implements ProjectStorageLike {
  value: string | null = null;
  writes = 0;
  failRead = false;
  failWrite: Error | null = null;

  getItem() {
    if (this.failRead) throw new Error("storage read details");
    return this.value;
  }

  setItem(_key: string, value: string) {
    this.writes += 1;
    if (this.failWrite) throw this.failWrite;
    this.value = value;
  }
}

const brief: BusinessBrief = {
  businessName: "Northline", description: "Brand design for climate ventures.", audience: "Early-stage founders",
  offering: "Brand identity", callToAction: "Book a call", style: "Professional",
};
const page = {
  headline: "Make your next chapter unmistakable.",
  subheadline: "Brand identity for early-stage climate ventures ready to grow with purpose.",
  features: ["A thoughtful identity for your next chapter", "Clear direction for meaningful growth"],
  callToAction: "Talk with our team",
};

function setup() {
  const storage = new MemoryStorage();
  let tick = 0;
  let id = 0;
  const projects = createProjectStorage({
    storage,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
    createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
  });
  return { storage, projects };
}

describe("persisted project schemas", () => {
  it("validates strict project records and collection versions", () => {
    const { projects } = setup();
    const saved = projects.create("Northline", projectSnapshotFromPage(brief, page, "split"));
    expect(ProjectRecordSchema.safeParse(saved).success).toBe(true);
    expect(ProjectCollectionSchema.safeParse({ version: 3, projects: [saved] }).success).toBe(true);
    expect(ProjectCollectionV2Schema.safeParse({ version: 2, projects: [{ ...saved, siteSettings: { navigation: saved.siteSettings.navigation, ctaDestination: saved.siteSettings.ctaDestination } }] }).success).toBe(true);
    expect(ProjectCollectionV1Schema.safeParse({ version: 1, projects: [saved] }).success).toBe(false);
    const legacyRecord = { ...saved } as Record<string, unknown>;
    delete legacyRecord.siteSettings;
    expect(ProjectCollectionV1Schema.safeParse({ version: 1, projects: [legacyRecord] }).success).toBe(true);
    expect(ProjectCollectionSchema.safeParse({ version: 3, projects: [saved, saved] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, id: "not-a-uuid" }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, name: "   " }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, name: "x".repeat(81) }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, brief: { ...brief, style: "unknown" } }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, content: { ...saved.content, features: ["tiny", "brief"] } }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, layout: "stacked" }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, updatedAt: "yesterday" }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, createdAt: "2027-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, unrelated: true }).success).toBe(false);
  });
});

describe("local project storage", () => {
  it("creates, saves, loads, renames, lists by recency, and deletes projects", () => {
    const { projects } = setup();
    const first = projects.create("  Northline  ", projectSnapshotFromPage(brief, page, "split"));
    expect(first.name).toBe("Northline");
    expect(first.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(first.updatedAt).toBe(first.createdAt);
    expect(first.revision).toBe(1);

    const second = projects.create("Second project", projectSnapshotFromPage(brief, page, "editorial"));
    const saved = projects.save(first.id, {
      brief: { ...brief, description: "A revised original brief description." },
      content: { ...first.content, description: "An independently edited website description for the saved project." },
      layout: "editorial",
      siteSettings: first.siteSettings,
    }, first.revision);
    expect(saved.revision).toBe(2);
    expect(saved.createdAt).toBe(first.createdAt);
    expect(saved.updatedAt).not.toBe(first.updatedAt);
    expect(projects.list().map((project) => project.id)).toEqual([saved.id, second.id]);
    expect(projects.load(saved.id)).toEqual(saved);

    const renamed = projects.rename(saved.id, "Updated name", saved.revision);
    expect(renamed.name).toBe("Updated name");
    expect(renamed.createdAt).toBe(saved.createdAt);
    expect(renamed.revision).toBe(3);
    projects.remove(second.id, second.revision);
    expect(projects.list().map((project) => project.id)).toEqual([renamed.id]);
    expect(() => projects.load(second.id)).toThrowError(ProjectStorageError);
  });

  it("round-trips the original brief separately from edited page content and restores layout and CTA", () => {
    const { storage, projects } = setup();
    const siteSettings: SiteSettings = {
      navigation: [
        { label: "Our work", destination: "#site-headline" },
        { label: "Collections", destination: "https://example.com/collections" },
        { label: "Journal", destination: "" },
      ],
      ctaDestination: "https://example.com/contact",
      appearance: {
        colors: { primary: "#1A2938", background: "#F7F4EE", accent: "#A56B42" },
        typography: "editorial-serif",
      },
    };
    const snapshot = projectSnapshotFromPage(brief, page, "split", siteSettings);
    const saved = projects.create("Northline", snapshot);
    const reopened = pageFromProject(projects.load(saved.id));
    expect(reopened).toMatchObject({
      ...brief,
      headline: page.headline,
      subheadline: page.subheadline,
      features: page.features,
      callToAction: page.callToAction,
      layout: "split",
    });
    expect(saved.brief.description).toBe(brief.description);
    expect(saved.content.description).toBe(page.subheadline);
    expect(saved.brief.callToAction).toBe(brief.callToAction);
    expect(saved.content.callToAction).toBe(page.callToAction);
    expect(JSON.parse(storage.value ?? "{}").projects[0].layout).toBe("split");
    expect(projects.load(saved.id).siteSettings).toEqual(siteSettings);
  });

  it("keeps updated timestamps increasing when the injected clock has the same time", () => {
    const storage = new MemoryStorage();
    const projects = createProjectStorage({
      storage,
      now: () => new Date("2026-04-01T12:00:00.000Z"),
      createId: (() => {
        let id = 0;
        return () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
      })(),
    });
    const created = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"));
    const updated = projects.save(created.id, projectSnapshotFromPage(brief, page, "split"), created.revision);
    expect(updated.updatedAt).toBe("2026-04-01T12:00:00.001Z");
    expect(updated.updatedAt > created.updatedAt).toBe(true);
  });

  it("rejects invalid project IDs, names, snapshots, and stale revisions without overwriting newer data", () => {
    const { storage, projects } = setup();
    expect(() => projects.load("bad-id")).toThrowError(ProjectStorageError);
    expect(() => projects.create("  ", projectSnapshotFromPage(brief, page, "editorial"))).toThrowError(ProjectStorageError);
    expect(() => projects.create("x".repeat(81), projectSnapshotFromPage(brief, page, "editorial"))).toThrowError(ProjectStorageError);
    expect(() => projects.create("Northline", { ...projectSnapshotFromPage(brief, page, "editorial"), layout: "wide" } as never)).toThrowError(ProjectStorageError);

    const created = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"));
    const updated = projects.save(created.id, projectSnapshotFromPage(brief, { ...page, callToAction: "Contact our studio" }, "split"), created.revision);
    const rawAfterUpdate = storage.value;
    expect(() => projects.save(created.id, projectSnapshotFromPage(brief, page, "editorial"), created.revision)).toThrowError(/another tab/);
    expect(storage.value).toBe(rawAfterUpdate);
    expect(updated.revision).toBe(2);
  });

  it("does not overwrite malformed JSON or invalid stored records", () => {
    const { storage, projects } = setup();
    storage.value = "{broken";
    expect(() => projects.list()).toThrowError(/invalid/);
    expect(() => projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"))).toThrowError(/invalid/);
    expect(storage.value).toBe("{broken");
    expect(storage.writes).toBe(0);

    storage.value = JSON.stringify({ version: 1, projects: [{ id: "invalid" }] });
    expect(() => projects.list()).toThrowError(/invalid/);
    expect(storage.value).toBe(JSON.stringify({ version: 1, projects: [{ id: "invalid" }] }));

    const malformedV2 = JSON.stringify({ version: 2, projects: [{ id: "invalid", siteSettings: { navigation: [], ctaDestination: "" } }] });
    storage.value = malformedV2;
    const writesBeforeMalformedV2 = storage.writes;
    expect(() => projects.list()).toThrowError(/invalid/);
    expect(storage.value).toBe(malformedV2);
    expect(storage.writes).toBe(writesBeforeMalformedV2);
  });

  it("migrates fully validated v1 records in memory and writes v3 on the next successful mutation", () => {
    const { storage, projects } = setup();
    const original = projects.create("Northline", projectSnapshotFromPage(brief, page, "split"));
    const v1Record = { ...original } as Record<string, unknown>;
    delete v1Record.siteSettings;
    const oldData = { version: 1, projects: [{ ...v1Record, revision: 7, name: "Legacy name" }] };
    storage.value = JSON.stringify(oldData);
    const writesBeforeRead = storage.writes;

    const loaded = projects.load(original.id);
    expect(loaded).toMatchObject({
      id: original.id,
      name: "Legacy name",
      brief: original.brief,
      content: original.content,
      layout: "split",
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
      revision: 7,
      siteSettings: DEFAULT_SITE_SETTINGS,
    });
    expect(storage.writes).toBe(writesBeforeRead);
    const saved = projects.save(loaded.id, projectSnapshotFromPage(loaded.brief, page, loaded.layout, loaded.siteSettings), loaded.revision);
    expect(saved.revision).toBe(8);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(3);
  });

  it("migrates v2 settings without changing project data and adds default appearance in memory", () => {
    const { storage, projects } = setup();
    const original = projects.create("Northline", projectSnapshotFromPage(brief, page, "split"));
    const v2 = { ...original, siteSettings: { navigation: original.siteSettings.navigation, ctaDestination: "https://example.com/contact" } };
    storage.value = JSON.stringify({ version: 2, projects: [v2] });
    const writesBeforeRead = storage.writes;
    const loaded = projects.load(original.id);
    expect(loaded).toMatchObject({
      id: original.id, name: original.name, brief: original.brief, content: original.content,
      layout: original.layout, createdAt: original.createdAt, updatedAt: original.updatedAt,
      revision: original.revision,
      siteSettings: { ...v2.siteSettings, appearance: DEFAULT_SITE_SETTINGS.appearance },
    });
    expect(storage.writes).toBe(writesBeforeRead);
    projects.save(loaded.id, projectSnapshotFromPage(loaded.brief, page, loaded.layout, loaded.siteSettings), loaded.revision);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(3);
  });

  it("never rewrites malformed or unsupported future collection versions", () => {
    const { storage, projects } = setup();
    for (const value of [{ version: 1, projects: [{ id: "bad" }] }, { version: 4, projects: [] }]) {
      storage.value = JSON.stringify(value);
      const before = storage.value;
      const writes = storage.writes;
      expect(() => projects.list()).toThrowError(ProjectStorageError);
      expect(storage.value).toBe(before);
      expect(storage.writes).toBe(writes);
    }
  });

  it("returns safe errors for unavailable and quota-limited storage", () => {
    const unavailable = new MemoryStorage();
    unavailable.failRead = true;
    const unavailableProjects = createProjectStorage({ storage: unavailable });
    let readError: unknown;
    try { unavailableProjects.list(); } catch (error) { readError = error; }
    expect(readError).toBeInstanceOf(ProjectStorageError);
    expect((readError as Error).message).toBe("Project storage is unavailable in this browser.");
    expect((readError as Error).message).not.toContain("storage read details");

    const quota = new MemoryStorage();
    quota.failWrite = Object.assign(new Error("private storage detail"), { name: "QuotaExceededError" });
    const quotaProjects = createProjectStorage({ storage: quota, createId: () => "00000000-0000-4000-8000-000000000001" });
    expect(() => quotaProjects.create("Northline", projectSnapshotFromPage(brief, page, "editorial")))
      .toThrowError("There is not enough browser storage space to save this project.");
    expect(quota.value).toBeNull();

    const failedWrite = new MemoryStorage();
    failedWrite.failWrite = new Error("private write details");
    const failedWriteProjects = createProjectStorage({ storage: failedWrite, createId: () => "00000000-0000-4000-8000-000000000002" });
    expect(() => failedWriteProjects.create("Northline", projectSnapshotFromPage(brief, page, "editorial")))
      .toThrowError("Project storage is unavailable in this browser.");
    expect(failedWrite.value).toBeNull();
  });
});
