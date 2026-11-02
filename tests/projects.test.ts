import { describe, expect, it } from "vitest";
import type { BusinessBrief } from "@/lib/generation";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";
import { DEFAULT_SITE_TEMPLATE, type FashionSiteTemplate, type RealEstateSiteTemplate, type SiteTemplate } from "@/lib/site-templates";
import {
  ProjectCollectionSchema,
  ProjectCollectionV1Schema,
  ProjectCollectionV2Schema,
  ProjectCollectionV3Schema,
  ProjectCollectionV4Schema,
  ProjectCollectionV5Schema,
  ProjectCollectionV6Schema,
  ProjectCollectionV7Schema,
  ProjectCollectionV8Schema,
  ProjectCollectionV9Schema,
  ProjectCollectionV10Schema,
  ProjectRecordSchema,
  ProjectRecordV6Schema,
  ProjectRecordV5Schema,
  ProjectRecordV7Schema,
  ProjectRecordV8Schema,
  ProjectRecordV9Schema,
  ProjectRecordV10Schema,
  ProjectStorageError,
  createProjectStorage,
  pageFromProject,
  editablePageFromProject,
  projectSnapshotFromPages,
  projectSnapshotFromPage,
  siteTemplateFromProject,
  type ProjectStorageLike,
  type ProjectRecord,
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
const heroImage = { mimeType: "image/webp" as const, base64: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString("base64") };

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

function homePage(project: ProjectRecord) {
  return project.pages.find((page) => page.id === "home")!;
}

function legacySettings(project: ProjectRecord) {
  return {
    ...project.siteSettings,
    navigation: project.siteSettings.navigation.map(({ label, destination }) => ({ label, destination })),
  };
}

function legacyRecord(project: ProjectRecord) {
  const home = homePage(project);
  return {
    id: project.id,
    name: project.name,
    brief: project.brief,
    content: home.content,
    layout: project.layout,
    siteSettings: legacySettings(project),
    heroImage: project.heroImage,
    template: home.template,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    revision: project.revision,
  };
}

function v8Record(project: ProjectRecord) {
  return {
    ...project,
    siteSettings: legacySettings(project),
    pages: project.pages.map((pageRecord) => ({
      id: pageRecord.id,
      slug: pageRecord.slug,
      title: pageRecord.title,
      content: pageRecord.content,
      template: pageRecord.template,
    })),
  };
}

function v9Record(project: ProjectRecord) {
  return { ...project, siteSettings: legacySettings(project) };
}

describe("persisted project schemas", () => {
  it("validates strict project records and collection versions", () => {
    const { projects } = setup();
    const saved = projects.create("Northline", projectSnapshotFromPage(brief, page, "split"));
    expect(homePage(saved).template).toEqual(DEFAULT_SITE_TEMPLATE);
    expect(ProjectRecordV9Schema.safeParse(saved).success).toBe(false);
    expect(ProjectRecordV10Schema.safeParse(saved).success).toBe(true);
    expect(saved.pages).toHaveLength(1);
    expect(saved.pages[0]).toMatchObject({ id: "home", slug: "index", title: "Home", kind: "home" });
    expect(ProjectRecordV8Schema.safeParse(v8Record(saved)).success).toBe(true);
    expect(ProjectCollectionV8Schema.safeParse({ version: 8, projects: [v8Record(saved)] }).success).toBe(true);
    expect(ProjectCollectionV9Schema.safeParse({ version: 9, projects: [v9Record(saved)] }).success).toBe(true);
    const legacy = legacyRecord(saved);
    expect(ProjectCollectionV7Schema.safeParse({ version: 7, projects: [legacy] }).success).toBe(true);
    expect(ProjectRecordV7Schema.safeParse(legacy).success).toBe(true);
    expect(ProjectCollectionV6Schema.safeParse({ version: 6, projects: [legacy] }).success).toBe(true);
    expect(ProjectRecordV6Schema.safeParse(legacy).success).toBe(true);
    expect(ProjectCollectionV5Schema.safeParse({ version: 5, projects: [legacy] }).success).toBe(true);
    expect(ProjectRecordV5Schema.safeParse(legacy).success).toBe(true);
    const fashionRecord = { ...legacy, template: { id: "fashion", content: { collectionHighlights: [
      { name: "Spring layers", description: "Lightweight pieces for the changing season." },
      { name: "Evening edit", description: "A considered selection for after-dark dressing." },
    ] } } };
    expect(ProjectRecordV7Schema.safeParse(fashionRecord).success).toBe(true);
    expect(ProjectRecordV5Schema.safeParse(fashionRecord).success).toBe(false);
    expect(ProjectCollectionV5Schema.safeParse({ version: 5, projects: [fashionRecord] }).success).toBe(false);
    const v4Record = { ...legacy } as Record<string, unknown>;
    delete v4Record.template;
    expect(ProjectCollectionV4Schema.safeParse({ version: 4, projects: [v4Record] }).success).toBe(true);
    const v3Record = { ...legacy } as Record<string, unknown>;
    delete v3Record.heroImage;
    delete v3Record.template;
    expect(ProjectCollectionV3Schema.safeParse({ version: 3, projects: [v3Record] }).success).toBe(true);
    const v2Record = { ...legacy, siteSettings: { navigation: legacySettings(saved).navigation, ctaDestination: saved.siteSettings.ctaDestination } } as Record<string, unknown>;
    delete v2Record.heroImage;
    delete v2Record.template;
    expect(ProjectCollectionV2Schema.safeParse({ version: 2, projects: [v2Record] }).success).toBe(true);
    expect(ProjectCollectionV1Schema.safeParse({ version: 1, projects: [saved] }).success).toBe(false);
    const legacyV1Record = { ...legacy } as Record<string, unknown>;
    delete legacyV1Record.siteSettings;
    delete legacyV1Record.heroImage;
    delete legacyV1Record.template;
    expect(ProjectCollectionV1Schema.safeParse({ version: 1, projects: [legacyV1Record] }).success).toBe(true);
    expect(ProjectCollectionSchema.safeParse({ version: 10, projects: [saved, saved] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, id: "not-a-uuid" }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, name: "   " }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, name: "x".repeat(81) }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, brief: { ...brief, style: "unknown" } }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [{ ...homePage(saved), content: { ...homePage(saved).content, features: ["tiny", "brief"] } }] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, layout: "stacked" }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [{ ...homePage(saved), template: { id: "restaurant" } }] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [{ ...homePage(saved), template: { id: "generic", content: {} } }] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, updatedAt: "yesterday" }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, createdAt: "2027-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, unrelated: true }).success).toBe(false);
    const aboutPage = { ...homePage(saved), id: "about", slug: "about", title: "About", kind: "about" as const };
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [homePage(saved), aboutPage] }).success).toBe(true);
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [homePage(saved), { ...aboutPage, id: "home" }] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [homePage(saved), { ...aboutPage, slug: "index" }] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [homePage(saved), { ...aboutPage, slug: "../about" }] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [homePage(saved), { ...aboutPage, kind: "contact" }] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, pages: [homePage(saved), aboutPage, { ...aboutPage, id: "about-copy", slug: "about-copy" }] }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, siteSettings: {
      ...saved.siteSettings,
      navigation: [
        { ...saved.siteSettings.navigation[0], target: { type: "page", pageId: "missing" } },
        ...saved.siteSettings.navigation.slice(1),
      ],
    } }).success).toBe(false);
    expect(ProjectRecordSchema.safeParse({ ...saved, siteSettings: {
      ...saved.siteSettings,
      navigation: [
        { ...saved.siteSettings.navigation[0], destination: "#site-menu", target: { type: "section", pageId: "home", anchor: "#site-menu" } },
        ...saved.siteSettings.navigation.slice(1),
      ],
    } }).success).toBe(false);
  });
});

describe("v8 page-kind migration and complete page snapshots", () => {
  it("infers only canonical identities whose template semantics agree and preserves ambiguous pages", () => {
    const { storage, projects } = setup();
    const base = projectSnapshotFromPage(brief, page, "split");
    const fashionTemplate: SiteTemplate = { id: "fashion", content: { collectionHighlights: [
      { name: "Spring layers", description: "Lightweight pieces for changing seasons." },
      { name: "Evening edit", description: "A considered direction for after-dark dressing." },
    ] } };
    const pages = [
      { ...base.pages[0], id: "home", slug: "landing", title: "Welcome", kind: "legacy" as const },
      { ...base.pages[0], id: "about", slug: "about", title: "About", kind: "legacy" as const },
      { ...base.pages[0], id: "services", slug: "services", title: "Services", kind: "legacy" as const, template: fashionTemplate },
      { ...base.pages[0], id: "campaign", slug: "campaign", title: "Campaign", kind: "legacy" as const },
    ];
    const created = projects.create("Northline", projectSnapshotFromPages(brief, pages, "split", undefined, heroImage));
    const oldCollection = { version: 8, projects: [v8Record(created)] };
    storage.value = JSON.stringify(oldCollection);
    const writesBeforeRead = storage.writes;

    const loaded = projects.load(created.id);
    expect(loaded.pages.map(({ kind }) => kind)).toEqual(["legacy", "about", "legacy", "legacy"]);
    expect(loaded.pages.map(({ id, slug, title }) => ({ id, slug, title })))
      .toEqual(created.pages.map(({ id, slug, title }) => ({ id, slug, title })));
    expect(loaded.pages.map(({ content, template }) => ({ content, template })))
      .toEqual(created.pages.map(({ content, template }) => ({ content, template })));
    expect(loaded).toMatchObject({ siteSettings: created.siteSettings, heroImage, createdAt: created.createdAt, updatedAt: created.updatedAt, revision: created.revision });
    expect(storage.writes).toBe(writesBeforeRead);
    expect(storage.value).toBe(JSON.stringify(oldCollection));

    const saved = projects.save(loaded.id, projectSnapshotFromPages(loaded.brief, loaded.pages, loaded.layout, loaded.siteSettings, loaded.heroImage), loaded.revision);
    expect(saved.pages.map(({ kind }) => kind)).toEqual(["legacy", "about", "legacy", "legacy"]);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
    expect(ProjectCollectionV10Schema.safeParse(JSON.parse(storage.value ?? "{}")).success).toBe(true);
  });

  it("preserves complete ordered page snapshots and derives editable page state without mutating records", () => {
    const { projects } = setup();
    const base = projectSnapshotFromPage(brief, page, "editorial");
    const about = { ...base.pages[0], id: "about", slug: "about", title: "About", kind: "about" as const };
    const contact = { ...base.pages[0], id: "contact", slug: "contact", title: "Contact", kind: "contact" as const };
    const pages = [base.pages[0], about, contact];
    const before = structuredClone(pages);
    const project = projects.create("Northline", projectSnapshotFromPages(brief, pages, "split"));

    expect(project.pages.map(({ id }) => id)).toEqual(["home", "about", "contact"]);
    expect(editablePageFromProject(project, "about")).toEqual({
      ...brief,
      headline: about.content.headline,
      subheadline: about.content.description,
      features: about.content.features,
      callToAction: about.content.callToAction,
      layout: "split",
    });
    expect(editablePageFromProject(project, "missing")).toBeNull();
    expect(pageFromProject(project)).toEqual(editablePageFromProject(project, "home"));
    expect(project.pages).toEqual(before);
    expect(pages).toEqual(before);
  });
});

describe("local project storage", () => {
  it("migrates v9 navigation in memory and writes typed v10 targets only on mutation", () => {
    const { storage, projects } = setup();
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "No destination", destination: "" },
        { label: "Order online", destination: "https://example.com/order" },
        { label: "Menu highlights", destination: "#site-menu" },
      ],
    };
    const restaurant: SiteTemplate = { id: "restaurant", content: { menuHighlights: [
      { name: "Roasted squash", description: "Seasonal vegetables prepared with fresh herbs." },
      { name: "House flatbread", description: "Freshly baked bread served with a bright herb dip." },
    ] } };
    const created = projects.create("Juniper Kitchen", projectSnapshotFromPage(brief, page, "split", settings, heroImage, restaurant));
    const legacy = v9Record(created);
    expect(ProjectCollectionV9Schema.safeParse({ version: 9, projects: [legacy] }).success).toBe(true);
    storage.value = JSON.stringify({ version: 9, projects: [legacy] });
    const priorRaw = storage.value;
    const writesBeforeRead = storage.writes;

    const loaded = projects.load(created.id);
    expect(loaded.siteSettings.navigation.map(({ label, target }) => ({ label, target }))).toEqual([
      { label: "No destination", target: { type: "none" } },
      { label: "Order online", target: { type: "external", url: "https://example.com/order" } },
      { label: "Menu highlights", target: { type: "section", pageId: "home", anchor: "#site-menu" } },
    ]);
    expect(loaded.pages).toEqual(created.pages);
    expect(loaded.brief).toEqual(created.brief);
    expect(loaded.heroImage).toEqual(heroImage);
    expect(loaded.revision).toBe(created.revision);
    expect(loaded.siteSettings.appearance).toEqual(created.siteSettings.appearance);
    expect(storage.writes).toBe(writesBeforeRead);
    expect(storage.value).toBe(priorRaw);

    const saved = projects.save(loaded.id, projectSnapshotFromPages(loaded.brief, loaded.pages, loaded.layout, loaded.siteSettings, loaded.heroImage), loaded.revision);
    const persisted = JSON.parse(storage.value ?? "{}");
    expect(persisted.version).toBe(10);
    expect(ProjectCollectionV10Schema.safeParse(persisted).success).toBe(true);
    expect(saved.siteSettings.navigation.map(({ label }) => label)).toEqual(["No destination", "Order online", "Menu highlights"]);
  });

  it("preserves safe but non-rendered legacy anchors as unresolved inactive targets", () => {
    const { storage, projects } = setup();
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Collections", destination: "#site-collections" },
        { label: "Properties", destination: "#site-properties" },
        { label: "Menu", destination: "#site-menu" },
      ],
    };
    const created = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial", settings));
    storage.value = JSON.stringify({ version: 9, projects: [v9Record(created)] });
    const migrated = projects.load(created.id);
    expect(migrated.siteSettings.navigation.map(({ target }) => target)).toEqual([
      { type: "unresolved", value: "#site-collections" },
      { type: "unresolved", value: "#site-properties" },
      { type: "unresolved", value: "#site-menu" },
    ]);
  });

  it("round-trips typed page destinations and checks them against the complete page array", () => {
    const { projects } = setup();
    const home = projectSnapshotFromPage(brief, page, "editorial").pages[0];
    const about = { ...home, id: "about", slug: "about", title: "About", kind: "about" as const };
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Meet the team", destination: "", target: { type: "page", pageId: "about" } },
        { label: "Contact hero", destination: "", target: { type: "section", pageId: "about", anchor: "#site-headline" } },
        { label: "Journal", destination: "" },
      ],
    };
    const created = projects.create("Northline", projectSnapshotFromPages(brief, [home, about], "editorial", settings));
    expect(created.siteSettings.navigation[0].target).toEqual({ type: "page", pageId: "about" });
    const saved = projects.save(created.id, projectSnapshotFromPages(brief, created.pages, created.layout, created.siteSettings), created.revision);
    expect(projects.load(saved.id).siteSettings.navigation).toEqual([
      { label: "Meet the team", destination: "", target: { type: "page", pageId: "about" } },
      { label: "Contact hero", destination: "", target: { type: "section", pageId: "about", anchor: "#site-headline" } },
      { label: "Journal", destination: "", target: { type: "none" } },
    ]);
    expect(() => projectSnapshotFromPages(brief, [home], "editorial", settings)).toThrow();
  });

  it("does not rewrite invalid v10 page references or unsupported future versions", () => {
    const { storage, projects } = setup();
    const created = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"));
    const invalid = {
      version: 10,
      projects: [{
        ...created,
        siteSettings: {
          ...created.siteSettings,
          navigation: [
            { ...created.siteSettings.navigation[0], destination: "", target: { type: "page", pageId: "missing" } },
            ...created.siteSettings.navigation.slice(1),
          ],
        },
      }],
    };
    storage.value = JSON.stringify(invalid);
    const before = storage.value;
    const writes = storage.writes;
    expect(() => projects.load(created.id)).toThrowError(ProjectStorageError);
    expect(storage.value).toBe(before);
    expect(storage.writes).toBe(writes);
  });

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
      layout: "editorial",
      siteSettings: first.siteSettings,
      heroImage: first.heroImage,
      pages: first.pages.map((item) => ({ ...item, content: { ...item.content, description: "An independently edited website description for the saved project." } })),
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
    const snapshot = projectSnapshotFromPage(brief, page, "split", siteSettings, heroImage);
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
    expect(homePage(saved).content.description).toBe(page.subheadline);
    expect(saved.brief.callToAction).toBe(brief.callToAction);
    expect(homePage(saved).content.callToAction).toBe(page.callToAction);
    expect(JSON.parse(storage.value ?? "{}").projects[0].layout).toBe("split");
    expect(projects.load(saved.id).siteSettings).toEqual(snapshot.siteSettings);
    expect(projects.load(saved.id).heroImage).toEqual(heroImage);
  });

  it("preserves an unknown-for-template custom navigation destination through load and save", () => {
    const { projects } = setup();
    const customSettings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Collections", destination: "#site-collections" },
        { label: "Properties", destination: "#site-properties" },
        { label: "External page", destination: "https://example.com/visit" },
      ],
    };
    const created = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial", customSettings));
    const loaded = projects.load(created.id);
    expect(loaded.siteSettings.navigation[0]).toEqual({ label: "Collections", destination: "#site-collections", target: { type: "unresolved", value: "#site-collections" } });
    const saved = projects.save(created.id, {
      ...projectSnapshotFromPage(brief, { ...page, headline: "Updated headline" }, "editorial", loaded.siteSettings, loaded.heroImage, siteTemplateFromProject(loaded)),
    }, loaded.revision);
    expect(saved.siteSettings.navigation).toEqual(created.siteSettings.navigation);
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

  it("migrates fully validated v1 records in memory and writes v7 on the next successful mutation", () => {
    const { storage, projects } = setup();
    const original = projects.create("Northline", projectSnapshotFromPage(brief, page, "split"));
    const v1Record = { ...legacyRecord(original) } as Record<string, unknown>;
    delete v1Record.siteSettings;
    delete v1Record.heroImage;
    delete v1Record.template;
    const oldData = { version: 1, projects: [{ ...v1Record, revision: 7, name: "Legacy name" }] };
    storage.value = JSON.stringify(oldData);
    const writesBeforeRead = storage.writes;

    const loaded = projects.load(original.id);
    expect(loaded).toMatchObject({
      id: original.id,
      name: "Legacy name",
      brief: original.brief,
      pages: [{ ...homePage(original), template: DEFAULT_SITE_TEMPLATE }],
      layout: "split",
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
      revision: 7,
      siteSettings: DEFAULT_SITE_SETTINGS,
      heroImage: null,
    });
    expect(storage.writes).toBe(writesBeforeRead);
    const saved = projects.save(loaded.id, projectSnapshotFromPage(loaded.brief, page, loaded.layout, loaded.siteSettings), loaded.revision);
    expect(saved.revision).toBe(8);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
  });

  it("migrates v2 settings without changing project data and adds default appearance in memory", () => {
    const { storage, projects } = setup();
    const original = projects.create("Northline", projectSnapshotFromPage(brief, page, "split"));
    const v2 = { ...legacyRecord(original), heroImage: undefined, siteSettings: { navigation: legacySettings(original).navigation, ctaDestination: "https://example.com/contact" } };
    delete (v2 as { heroImage?: unknown }).heroImage;
    delete (v2 as { template?: unknown }).template;
    storage.value = JSON.stringify({ version: 2, projects: [v2] });
    const writesBeforeRead = storage.writes;
    const loaded = projects.load(original.id);
    expect(loaded).toMatchObject({
      id: original.id, name: original.name, brief: original.brief, pages: [{ ...homePage(original), template: DEFAULT_SITE_TEMPLATE }],
      layout: original.layout, createdAt: original.createdAt, updatedAt: original.updatedAt,
      revision: original.revision,
      siteSettings: { ...v2.siteSettings, appearance: DEFAULT_SITE_SETTINGS.appearance },
      heroImage: null,
    });
    expect(storage.writes).toBe(writesBeforeRead);
    projects.save(loaded.id, projectSnapshotFromPage(loaded.brief, page, loaded.layout, loaded.siteSettings, loaded.heroImage, siteTemplateFromProject(loaded)), loaded.revision);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
  });

  it("migrates validated v3 projects to v7 without writes and preserves their settings and revisions", () => {
    const { storage, projects } = setup();
    const original = projects.create("Northline", projectSnapshotFromPage(brief, page, "split"));
    const v3Record = { ...legacyRecord(original) } as Record<string, unknown>;
    delete v3Record.heroImage;
    delete v3Record.template;
    storage.value = JSON.stringify({ version: 3, projects: [{ ...v3Record, revision: 11 }] });
    const writesBeforeRead = storage.writes;
    const loaded = projects.load(original.id);
    expect(loaded).toMatchObject({
      id: original.id, name: original.name, brief: original.brief, pages: [{ ...homePage(original), template: DEFAULT_SITE_TEMPLATE }],
      layout: original.layout, siteSettings: original.siteSettings, createdAt: original.createdAt,
      updatedAt: original.updatedAt, revision: 11, heroImage: null,
    });
    expect(storage.writes).toBe(writesBeforeRead);
    projects.save(loaded.id, projectSnapshotFromPage(loaded.brief, page, loaded.layout, loaded.siteSettings, loaded.heroImage, siteTemplateFromProject(loaded)), loaded.revision);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
  });

  it("migrates fully validated v4 projects to generic v7 in memory without losing settings or image", () => {
    const { storage, projects } = setup();
    const original = projects.create("Northline", projectSnapshotFromPage(brief, page, "split", DEFAULT_SITE_SETTINGS, heroImage));
    const v4Record = { ...legacyRecord(original) } as Record<string, unknown>;
    delete v4Record.template;
    storage.value = JSON.stringify({ version: 4, projects: [v4Record] });
    const writesBeforeRead = storage.writes;

    const loaded = projects.load(original.id);
    expect(loaded).toMatchObject({
      id: original.id,
      name: original.name,
      brief: original.brief,
      pages: [{ ...homePage(original), template: DEFAULT_SITE_TEMPLATE }],
      layout: original.layout,
      siteSettings: original.siteSettings,
      heroImage,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
      revision: original.revision,
    });
    expect(storage.writes).toBe(writesBeforeRead);
    const saved = projects.save(loaded.id, projectSnapshotFromPage(loaded.brief, page, loaded.layout, loaded.siteSettings, loaded.heroImage, siteTemplateFromProject(loaded)), loaded.revision);
    expect(saved.revision).toBe(original.revision + 1);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
    expect(JSON.parse(storage.value ?? "{}").projects[0].pages[0].template).toEqual(DEFAULT_SITE_TEMPLATE);
  });

  it("migrates strict v5 records to v7 in memory and writes v7 only on a successful mutation", () => {
    const { storage, projects } = setup();
    const settings: SiteSettings = {
      navigation: [
        { label: "Our story", destination: "#site-story" },
        { label: "Menu", destination: "#site-menu" },
        { label: "Visit", destination: "https://example.com/visit" },
      ],
      ctaDestination: "https://example.com/contact",
      appearance: {
        colors: { primary: "#000000", background: "#FFFFFF", accent: "#FFFFFF" },
        typography: "editorial-serif",
      },
    };
    const restaurantTemplate: SiteTemplate = {
      id: "restaurant",
      content: {
        menuHighlights: [
          { name: "Roasted squash", description: "Seasonal squash with herbs and toasted seeds." },
          { name: "House sourdough", description: "Slow-fermented bread baked fresh each morning." },
        ],
        story: "A neighborhood kitchen shaped by seasonal ingredients.",
        location: "Central district",
        openingHours: "Tuesday to Sunday, 11 am to 9 pm",
      },
    };
    const generic = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"));
    const saved = projects.create("Juniper Kitchen", projectSnapshotFromPage(brief, page, "split", settings, heroImage, restaurantTemplate));
    const v5Collection = { version: 5, projects: [legacyRecord(generic), { ...legacyRecord(saved), revision: 9 }] };
    const fixtureBeforeRead = JSON.parse(JSON.stringify(v5Collection));
    storage.value = JSON.stringify(v5Collection);
    const writesBeforeRead = storage.writes;

    const loaded = projects.load(saved.id);
    expect(loaded).toEqual({ ...saved, revision: 9 });
    expect(projects.load(generic.id)).toEqual(generic);
    expect(storage.writes).toBe(writesBeforeRead);
    expect(v5Collection).toEqual(fixtureBeforeRead);

    const persisted = projects.save(loaded.id, projectSnapshotFromPage(
      loaded.brief, page, loaded.layout, loaded.siteSettings, loaded.heroImage, siteTemplateFromProject(loaded),
    ), loaded.revision);
    const written = JSON.parse(storage.value ?? "{}") as { version: number; projects: Array<Record<string, unknown>> };
    expect(written.version).toBe(10);
    expect(persisted.revision).toBe(10);
    expect(written.projects.find((project) => project.id === saved.id)).toMatchObject({
      id: saved.id,
      name: saved.name,
      brief: saved.brief,
      pages: [homePage(saved)],
      layout: saved.layout,
      siteSettings: settings,
      heroImage,
      revision: 10,
    });
    expect(written.projects.find((project) => project.id === generic.id)).toEqual(generic);
    expect(ProjectCollectionV10Schema.safeParse(written).success).toBe(true);
  });

  it("creates, saves, and renames Fashion projects using the v8 schema", () => {
    const { projects, storage } = setup();
    const fashionTemplate: FashionSiteTemplate = {
      id: "fashion",
      content: {
        collectionHighlights: [
          { name: "Spring layers", description: "Lightweight pieces for changing weather and everyday layering." },
          { name: "Evening edit", description: "A considered selection for after-dark dressing and events." },
        ],
        brandStory: "An independent design studio exploring considered everyday dressing.",
      },
    };
    const created = projects.create("Northline Studio", projectSnapshotFromPage(brief, page, "editorial", DEFAULT_SITE_SETTINGS, null, fashionTemplate));
    expect(siteTemplateFromProject(projects.load(created.id))).toEqual(fashionTemplate);

    const saved = projects.save(created.id, projectSnapshotFromPage(brief, page, "split", created.siteSettings, created.heroImage, fashionTemplate), created.revision);
    const editedTemplate: FashionSiteTemplate = {
      id: "fashion",
      content: {
        collectionHighlights: [
          { name: "Edited everyday forms", description: "Updated collection copy for considered daily dressing." },
          fashionTemplate.content.collectionHighlights[1],
        ],
      },
    };
    const edited = projects.save(saved.id, projectSnapshotFromPage(brief, page, "split", saved.siteSettings, saved.heroImage, editedTemplate), saved.revision);
    const reopened = projects.load(edited.id);
    const renamed = projects.rename(reopened.id, "Northline Fashion", reopened.revision);
    expect(siteTemplateFromProject(reopened)).toEqual(editedTemplate);
    expect(siteTemplateFromProject(renamed)).toEqual(editedTemplate);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
    expect(ProjectCollectionSchema.safeParse(JSON.parse(storage.value ?? "{}")).success).toBe(true);
  });

  it("migrates strict v6 Generic, Restaurant, and Fashion records to v8 in memory without losing project data", () => {
    const { storage, projects } = setup();
    const restaurantTemplate: SiteTemplate = {
      id: "restaurant",
      content: {
        menuHighlights: [
          { name: "Roasted squash", description: "Seasonal squash with herbs and toasted seeds." },
          { name: "House sourdough", description: "Slow-fermented bread baked fresh each morning." },
        ],
        story: "A neighborhood kitchen shaped by seasonal ingredients.",
      },
    };
    const fashionTemplate: FashionSiteTemplate = {
      id: "fashion",
      content: { collectionHighlights: [
        { name: "Spring layers", description: "Lightweight pieces for changing weather and daily dressing." },
        { name: "Evening edit", description: "A considered direction for after-dark looks and events." },
      ], brandStory: "An independent studio exploring considered everyday design." },
    };
    const generic = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"));
    const restaurant = projects.create("Juniper Kitchen", projectSnapshotFromPage(brief, page, "split", DEFAULT_SITE_SETTINGS, heroImage, restaurantTemplate));
    const fashion = projects.create("Northline Studio", projectSnapshotFromPage(brief, page, "split", DEFAULT_SITE_SETTINGS, heroImage, fashionTemplate));
    const v6Collection = { version: 6, projects: [legacyRecord(generic), { ...legacyRecord(restaurant), revision: 4 }, { ...legacyRecord(fashion), revision: 9 }] };
    const inputBeforeRead = JSON.parse(JSON.stringify(v6Collection));
    expect(ProjectCollectionV6Schema.safeParse(v6Collection).success).toBe(true);
    expect(ProjectCollectionV6Schema.safeParse({ version: 6, projects: [{ ...legacyRecord(generic), template: {
      id: "real-estate", content: { featuredProperties: [
        { name: "Property one", description: "A grounded property highlight." },
        { name: "Property two", description: "Another grounded property highlight." },
      ] },
    } }] }).success).toBe(false);
    storage.value = JSON.stringify(v6Collection);
    const writesBeforeRead = storage.writes;

    expect(projects.load(generic.id)).toEqual(generic);
    expect(projects.load(restaurant.id)).toEqual({ ...restaurant, revision: 4 });
    expect(projects.load(fashion.id)).toEqual({ ...fashion, revision: 9 });
    expect(storage.writes).toBe(writesBeforeRead);
    expect(v6Collection).toEqual(inputBeforeRead);

    const loadedFashion = projects.load(fashion.id);
    const savedFashion = projects.save(loadedFashion.id, projectSnapshotFromPage(
      loadedFashion.brief, page, loadedFashion.layout, loadedFashion.siteSettings, loadedFashion.heroImage, siteTemplateFromProject(loadedFashion),
    ), loadedFashion.revision);
    const persisted = JSON.parse(storage.value ?? "{}") as { version: number; projects: Array<Record<string, unknown>> };
    expect(persisted.version).toBe(10);
    expect(savedFashion.revision).toBe(10);
    expect(persisted.projects.find((item) => item.id === generic.id)).toEqual(generic);
    expect(persisted.projects.find((item) => item.id === restaurant.id)).toEqual({ ...restaurant, revision: 4 });
    expect(persisted.projects.find((item) => item.id === fashion.id)).toMatchObject({
      id: fashion.id, name: fashion.name, brief: fashion.brief, pages: [{ ...homePage(fashion), template: fashionTemplate }], layout: fashion.layout,
      siteSettings: fashion.siteSettings, heroImage, revision: 10,
      createdAt: fashion.createdAt, updatedAt: expect.any(String),
    });
    expect(ProjectCollectionV10Schema.safeParse(persisted).success).toBe(true);
  });

  it("migrates v7 records into one home page without writing until a successful mutation", () => {
    const { storage, projects } = setup();
    const customSettings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Menu", destination: "#site-menu" },
        { label: "Our story", destination: "#site-story" },
        { label: "Visit", destination: "https://example.com/visit" },
      ],
      appearance: {
        colors: { primary: "#000000", background: "#FFFFFF", accent: "#A56B42" },
        typography: "editorial-serif",
      },
    };
    const restaurantTemplate: SiteTemplate = {
      id: "restaurant",
      content: {
        menuHighlights: [
          { name: "Fire-roasted vegetables", description: "Seasonal vegetables prepared over a carefully tended flame." },
          { name: "House flatbread", description: "Freshly baked flatbread served with a bright herb dip." },
        ],
        story: "A neighborhood kitchen focused on thoughtful food and welcoming tables.",
        location: "Central district",
        openingHours: "Tuesday to Sunday, 11 am to 9 pm",
      },
    };
    const created = projects.create("Juniper Kitchen", projectSnapshotFromPage(brief, page, "split", customSettings, heroImage, restaurantTemplate));
    const legacy = { ...legacyRecord(created), revision: 14 };
    const originalCollection = { version: 7, projects: [legacy] };
    storage.value = JSON.stringify(originalCollection);
    const writesBeforeRead = storage.writes;

    const migrated = projects.load(created.id);
    expect(migrated).toMatchObject({
      id: created.id,
      name: created.name,
      brief: created.brief,
      layout: "split",
      siteSettings: customSettings,
      heroImage,
      pages: [{ id: "home", slug: "index", title: "Home", content: homePage(created).content, template: restaurantTemplate }],
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      revision: 14,
    });
    expect(storage.writes).toBe(writesBeforeRead);

    const renamed = projects.rename(migrated.id, "Juniper Kitchen House", migrated.revision);
    expect(renamed.revision).toBe(15);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
    expect(ProjectCollectionV10Schema.safeParse(JSON.parse(storage.value ?? "{}")).success).toBe(true);
  });

  it("round-trips valid Real Estate template data through v7 project mutations", () => {
    const { projects, storage } = setup();
    const realEstateTemplate: RealEstateSiteTemplate = {
      id: "real-estate",
      content: {
        featuredProperties: [
          { name: "Modern living", description: "A thoughtfully presented residential property highlight." },
          { name: "Connected spaces", description: "A second property highlight grounded in the agency brief." },
        ],
        agencyStory: "An independent agency focused on clear, considered property guidance.",
      },
    };
    const created = projects.create("Northline Property Group", projectSnapshotFromPage(brief, page, "editorial", DEFAULT_SITE_SETTINGS, heroImage, realEstateTemplate));
    expect(siteTemplateFromProject(projects.load(created.id))).toEqual(realEstateTemplate);
    const editedTemplate: RealEstateSiteTemplate = {
      id: "real-estate",
      content: {
        featuredProperties: [
          { name: "Edited city homes", description: "Updated residential property copy grounded in the agency's brief." },
          realEstateTemplate.content.featuredProperties[1],
        ],
      },
    };
    const saved = projects.save(created.id, projectSnapshotFromPage(brief, page, "split", created.siteSettings, created.heroImage, editedTemplate), created.revision);
    expect(siteTemplateFromProject(projects.load(saved.id))).toEqual(editedTemplate);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
    expect(ProjectCollectionV10Schema.safeParse(JSON.parse(storage.value ?? "{}")).success).toBe(true);
  });

  it("does not rewrite a v6 collection containing a template variant unsupported by v6", () => {
    const { storage, projects } = setup();
    const existing = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"));
    const invalidV6 = {
      version: 6,
      projects: [{ ...legacyRecord(existing), template: {
        id: "real-estate",
        content: { featuredProperties: [
          { name: "Property one", description: "A grounded property highlight." },
          { name: "Property two", description: "Another grounded property highlight." },
        ] },
      } }],
    };
    storage.value = JSON.stringify(invalidV6);
    const originalValue = storage.value;
    const writesBeforeRead = storage.writes;

    expect(() => projects.list()).toThrowError(ProjectStorageError);
    expect(() => projects.rename(existing.id, "Renamed", existing.revision)).toThrowError(ProjectStorageError);
    expect(storage.value).toBe(originalValue);
    expect(storage.writes).toBe(writesBeforeRead);
  });

  it("round-trips restaurant template content through project creation and ordinary mutations", () => {
    const { projects, storage } = setup();
    const restaurantTemplate: SiteTemplate = {
      id: "restaurant",
      content: {
        menuHighlights: [
          { name: "Roasted squash", description: "Seasonal squash with herbs and toasted seeds." },
          { name: "House sourdough", description: "Slow-fermented bread baked fresh each morning." },
        ],
        story: "A neighborhood kitchen shaped by seasonal ingredients and shared tables.",
        location: "Central district",
        openingHours: "Tuesday to Sunday, 11 am to 9 pm",
      },
    };
    const created = projects.create("Juniper Kitchen", projectSnapshotFromPage(brief, page, "editorial", DEFAULT_SITE_SETTINGS, heroImage, restaurantTemplate));
    expect(siteTemplateFromProject(projects.load(created.id))).toEqual(restaurantTemplate);

    const saved = projects.save(created.id, projectSnapshotFromPage(brief, page, "split", created.siteSettings, created.heroImage, restaurantTemplate), created.revision);
    const renamed = projects.rename(saved.id, "Juniper Kitchen House", saved.revision);
    expect(siteTemplateFromProject(renamed)).toEqual(restaurantTemplate);
    expect(JSON.parse(storage.value ?? "{}").version).toBe(10);
    expect(JSON.parse(storage.value ?? "{}").projects[0].pages[0].template).toEqual(restaurantTemplate);
  });

  it("refuses to persist restaurant templates outside the valid two-to-four menu highlight bounds", () => {
    const { projects } = setup();
    const base = projectSnapshotFromPage(brief, page, "editorial");
    const invalid = {
      ...base,
      pages: [{
        ...base.pages[0],
        template: {
          id: "restaurant",
          content: { menuHighlights: [{ name: "Only dish", description: "A valid description for this dish." }] },
        },
      }],
    } as never;
    expect(() => projects.create("Northline", invalid)).toThrowError(ProjectStorageError);
  });

  it("never rewrites malformed or unsupported future collection versions", () => {
    const { storage, projects } = setup();
    for (const value of [{ version: 1, projects: [{ id: "bad" }] }, { version: 11, projects: [] }]) {
      storage.value = JSON.stringify(value);
      const before = storage.value;
      const writes = storage.writes;
      expect(() => projects.list()).toThrowError(ProjectStorageError);
      expect(() => projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"))).toThrowError(ProjectStorageError);
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

  it("keeps existing records intact when saving an image exceeds browser storage quota", () => {
    const { storage, projects } = setup();
    const saved = projects.create("Northline", projectSnapshotFromPage(brief, page, "editorial"));
    const beforeFailure = storage.value;
    storage.failWrite = Object.assign(new Error("private quota detail"), { name: "QuotaExceededError" });
    expect(() => projects.save(saved.id, projectSnapshotFromPage(brief, page, "editorial", saved.siteSettings, heroImage), saved.revision))
      .toThrowError("There is not enough browser storage space to save this project.");
    expect(storage.value).toBe(beforeFailure);
    expect(projects.load(saved.id).heroImage).toBeNull();
  });
});
