import { describe, expect, it } from "vitest";
import type { BusinessBrief } from "@/lib/generation";
import {
  ProjectCollectionSchema,
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
    expect(ProjectCollectionSchema.safeParse({ version: 1, projects: [saved] }).success).toBe(true);
    expect(ProjectCollectionSchema.safeParse({ version: 2, projects: [saved] }).success).toBe(false);
    expect(ProjectCollectionSchema.safeParse({ version: 1, projects: [saved, saved] }).success).toBe(false);
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
    const snapshot = projectSnapshotFromPage(brief, page, "split");
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
