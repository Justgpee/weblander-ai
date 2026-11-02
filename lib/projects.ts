import { z } from "zod";
import { BusinessBriefSchema, type BusinessBrief } from "@/lib/generation";
import { hasCanonicalSitePageIdentity, inferSitePageKind, isSitePageKindCompatible, SitePageKindSchema, type SitePageKind } from "@/lib/site-page-kind";
import { HeroImageAssetSchema, type HeroImageAsset } from "@/lib/site-image";
import {
  DEFAULT_SITE_TEMPLATE,
  SiteTemplateSchema,
  SiteTemplateV6Schema,
  SiteTemplateV5Schema,
  type SiteTemplate,
} from "@/lib/site-templates";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_SITE_SETTINGS,
  SiteSettingsV2Schema,
  SiteSettingsV9Schema,
  SiteSettingsV10Schema,
  validateAppearanceContrast,
  type SiteSettings,
} from "@/lib/site-settings";
import { normalizeSiteNavigationTargets, validateSiteNavigationTargets } from "@/lib/site-navigation-options";

export const PROJECT_STORAGE_KEY = "weblander-ai:projects";
export const PROJECT_COLLECTION_VERSION = 10;

export const ProjectIdSchema = z.string().uuid();
export const ProjectNameSchema = z.string().trim().min(1).max(80);
export const ProjectLayoutSchema = z.enum(["editorial", "split"]);

export const ProjectPageContentSchema = z.object({
  headline: z.string().trim().min(8).max(100),
  description: z.string().trim().min(20).max(240),
  features: z.array(z.string().trim().min(8).max(90)).min(2).max(4),
  callToAction: z.string().trim().min(1).max(36),
}).strict();
export type ProjectPageContent = z.infer<typeof ProjectPageContentSchema>;

export const ProjectPageIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
export const ProjectPageSlugSchema = z.string().max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const ProjectPageTitleSchema = z.string().trim().min(1).max(60);
/** Frozen v8 page record retained for migration and the page-generation API response. */
export const ProjectPageV8Schema = z.object({
  id: ProjectPageIdSchema,
  slug: ProjectPageSlugSchema,
  title: ProjectPageTitleSchema,
  content: ProjectPageContentSchema,
  template: SiteTemplateSchema,
}).strict();
export type ProjectPageV8 = z.infer<typeof ProjectPageV8Schema>;

export const ProjectPageSchema = ProjectPageV8Schema.extend({
  kind: SitePageKindSchema,
}).strict().superRefine((page, context) => {
  if (page.kind !== "legacy" && !isSitePageKindCompatible(page.kind, page.template.id)) {
    context.addIssue({ code: "custom", path: ["kind"], message: "This page kind is not supported by its template." });
  }
  if (page.kind !== "legacy" && !hasCanonicalSitePageIdentity(page.kind, page)) {
    context.addIssue({ code: "custom", path: ["id"], message: "This page kind must use its stable page identity." });
  }
});
export type ProjectPage = z.infer<typeof ProjectPageSchema>;

function withUniquePages<T extends { pages: Array<{ id: string; slug: string; kind?: SitePageKind }> }>(schema: z.ZodType<T>) {
  return schema.superRefine((value, context) => {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    const kinds = new Set<SitePageKind>();
    value.pages.forEach((page, index) => {
      if (ids.has(page.id)) context.addIssue({ code: "custom", path: ["pages", index, "id"], message: "Page IDs must be unique." });
      if (slugs.has(page.slug)) context.addIssue({ code: "custom", path: ["pages", index, "slug"], message: "Page slugs must be unique." });
      if (page.kind && page.kind !== "legacy" && kinds.has(page.kind)) {
        context.addIssue({ code: "custom", path: ["pages", index, "kind"], message: "Each standard page kind may appear only once." });
      }
      ids.add(page.id);
      slugs.add(page.slug);
      if (page.kind && page.kind !== "legacy") kinds.add(page.kind);
    });
    if (!value.pages.some((page) => page.id === "home")) {
      context.addIssue({ code: "custom", path: ["pages"], message: "A site must include its home page." });
    }
  });
}

const ProjectSnapshotBaseSchema = z.object({
  brief: BusinessBriefSchema,
  layout: ProjectLayoutSchema,
  siteSettings: SiteSettingsV10Schema,
  heroImage: HeroImageAssetSchema.nullable(),
  pages: z.array(ProjectPageSchema).min(1).max(20),
}).strict();
export const ProjectSnapshotSchema = withUniquePages(ProjectSnapshotBaseSchema).superRefine((snapshot, context) => {
  const contrast = validateAppearanceContrast(snapshot.brief.style, snapshot.siteSettings.appearance);
  if (!contrast.valid) context.addIssue({ code: "custom", path: ["siteSettings", "appearance"], message: contrast.issues.join(" ") });
  if (!validateSiteNavigationTargets(snapshot.siteSettings, snapshot.pages)) context.addIssue({
    code: "custom", path: ["siteSettings", "navigation"], message: "Navigation destinations must reference an existing page and rendered section.",
  });
});
export type ProjectSnapshot = z.infer<typeof ProjectSnapshotSchema>;

const ProjectRecordFields = {
  id: ProjectIdSchema,
  name: ProjectNameSchema,
  brief: BusinessBriefSchema,
  content: ProjectPageContentSchema,
  layout: ProjectLayoutSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revision: z.number().int().positive(),
};
const ProjectRecordV7Fields = {
  ...ProjectRecordFields,
  siteSettings: SiteSettingsV9Schema,
  heroImage: HeroImageAssetSchema.nullable(),
  template: SiteTemplateSchema,
};

function withProjectTimeValidation<T extends z.ZodRawShape>(shape: T) {
  const schema = z.object(shape).strict();
  return schema.superRefine((value, context) => {
    const project = value as { createdAt: string; updatedAt: string };
    if (Date.parse(project.updatedAt) < Date.parse(project.createdAt)) {
      context.addIssue({ code: "custom", path: ["updatedAt"], message: "Updated time cannot be earlier than creation time." });
    }
  });
}

export const ProjectRecordV1Schema = withProjectTimeValidation(ProjectRecordFields);
export const ProjectRecordV2Schema = withProjectTimeValidation({ ...ProjectRecordFields, siteSettings: SiteSettingsV2Schema });
export const ProjectRecordV3Schema = withProjectTimeValidation({ ...ProjectRecordFields, siteSettings: SiteSettingsV9Schema });
const ProjectRecordV4Fields = { ...ProjectRecordFields, siteSettings: SiteSettingsV9Schema, heroImage: HeroImageAssetSchema.nullable() };
function validateProjectAppearance<T extends { brief: BusinessBrief; siteSettings: SiteSettings }>(schema: z.ZodType<T>) {
  return schema.superRefine((project, context) => {
    const contrast = validateAppearanceContrast(project.brief.style, project.siteSettings.appearance);
    if (!contrast.valid) context.addIssue({ code: "custom", path: ["siteSettings", "appearance"], message: contrast.issues.join(" ") });
  });
}
export const ProjectRecordV4Schema = validateProjectAppearance(withProjectTimeValidation(ProjectRecordV4Fields));
export const ProjectRecordV5Schema = validateProjectAppearance(withProjectTimeValidation({
  ...ProjectRecordV4Fields,
  template: SiteTemplateV5Schema,
}));
export const ProjectRecordV6Schema = validateProjectAppearance(withProjectTimeValidation({
  ...ProjectRecordV4Fields,
  template: SiteTemplateV6Schema,
}));
export const ProjectRecordV7Schema = validateProjectAppearance(withProjectTimeValidation(ProjectRecordV7Fields));
export const ProjectRecordV8Schema = validateProjectAppearance(withUniquePages(withProjectTimeValidation({
  id: ProjectIdSchema,
  name: ProjectNameSchema,
  brief: BusinessBriefSchema,
  layout: ProjectLayoutSchema,
  siteSettings: SiteSettingsV9Schema,
  heroImage: HeroImageAssetSchema.nullable(),
  pages: z.array(ProjectPageV8Schema).min(1).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revision: z.number().int().positive(),
})));
export const ProjectRecordV9Schema = validateProjectAppearance(withUniquePages(withProjectTimeValidation({
  id: ProjectIdSchema,
  name: ProjectNameSchema,
  brief: BusinessBriefSchema,
  layout: ProjectLayoutSchema,
  siteSettings: SiteSettingsV9Schema,
  heroImage: HeroImageAssetSchema.nullable(),
  pages: z.array(ProjectPageSchema).min(1).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revision: z.number().int().positive(),
})));
export const ProjectRecordV10Schema = validateProjectAppearance(withUniquePages(withProjectTimeValidation({
  id: ProjectIdSchema,
  name: ProjectNameSchema,
  brief: BusinessBriefSchema,
  layout: ProjectLayoutSchema,
  siteSettings: SiteSettingsV10Schema,
  heroImage: HeroImageAssetSchema.nullable(),
  pages: z.array(ProjectPageSchema).min(1).max(20),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  revision: z.number().int().positive(),
}))).superRefine((project, context) => {
  if (!validateSiteNavigationTargets(project.siteSettings, project.pages)) context.addIssue({
    code: "custom", path: ["siteSettings", "navigation"], message: "Navigation destinations must reference an existing page and rendered section.",
  });
});
export const ProjectRecordSchema = ProjectRecordV10Schema;
export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;

export const ProjectCollectionV1Schema = z.object({
  version: z.literal(1),
  projects: z.array(ProjectRecordV1Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));

export const ProjectCollectionV2Schema = z.object({
  version: z.literal(2),
  projects: z.array(ProjectRecordV2Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));

export const ProjectCollectionV3Schema = z.object({
  version: z.literal(3),
  projects: z.array(ProjectRecordV3Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));

export const ProjectCollectionV4Schema = z.object({
  version: z.literal(4),
  projects: z.array(ProjectRecordV4Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));

export const ProjectCollectionV5Schema = z.object({
  version: z.literal(5),
  projects: z.array(ProjectRecordV5Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));

export const ProjectCollectionV6Schema = z.object({
  version: z.literal(6),
  projects: z.array(ProjectRecordV6Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));

export const ProjectCollectionV7Schema = z.object({
  version: z.literal(7),
  projects: z.array(ProjectRecordV7Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));
export const ProjectCollectionV8Schema = z.object({
  version: z.literal(8),
  projects: z.array(ProjectRecordV8Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));
export const ProjectCollectionV9Schema = z.object({
  version: z.literal(9),
  projects: z.array(ProjectRecordV9Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));
export const ProjectCollectionV10Schema = z.object({
  version: z.literal(PROJECT_COLLECTION_VERSION),
  projects: z.array(ProjectRecordV10Schema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));
export const ProjectCollectionSchema = ProjectCollectionV10Schema;

function validateUniqueProjectIds(projects: Array<{ id: string }>, context: z.RefinementCtx) {
  const seenIds = new Set<string>();
  projects.forEach((project, index) => {
    if (seenIds.has(project.id)) {
      context.addIssue({ code: "custom", path: ["projects", index, "id"], message: "Project IDs must be unique." });
    }
    seenIds.add(project.id);
  });
}
export type ProjectCollection = z.infer<typeof ProjectCollectionSchema>;

export type ProjectStorageLike = Pick<Storage, "getItem" | "setItem">;
export type ProjectStorageOptions = {
  storage: ProjectStorageLike;
  now?: () => Date;
  createId?: () => string;
};

export type ProjectStorageErrorCode = "UNAVAILABLE" | "CORRUPT" | "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "QUOTA" | "FAILED";

const SAFE_MESSAGES: Record<ProjectStorageErrorCode, string> = {
  UNAVAILABLE: "Project storage is unavailable in this browser.",
  CORRUPT: "Saved project data is invalid. No saved projects were changed.",
  INVALID_INPUT: "Project details are invalid. Check the project name and website content.",
  NOT_FOUND: "That project could not be found.",
  CONFLICT: "This project changed in another tab. Reload it before saving again.",
  QUOTA: "There is not enough browser storage space to save this project.",
  FAILED: "The project could not be saved. Please try again.",
};

export class ProjectStorageError extends Error {
  constructor(public readonly code: ProjectStorageErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "ProjectStorageError";
  }
}

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ProjectStorageError("INVALID_INPUT");
  return result.data;
}

function isQuotaError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

type LegacyProjectRecord = {
  id: string;
  name: string;
  brief: BusinessBrief;
  content: ProjectPageContent;
  layout: "editorial" | "split";
  siteSettings: SiteSettings;
  heroImage: HeroImageAsset | null;
  template?: SiteTemplate;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

function migrateLegacyProject(project: LegacyProjectRecord): ProjectRecord {
  const { content, template, ...site } = project;
  const pages = [{ id: "home", slug: "index", title: "Home", kind: "home" as const, content, template: template ?? DEFAULT_SITE_TEMPLATE }];
  return ProjectRecordSchema.parse({
    ...site,
    siteSettings: SiteSettingsV10Schema.parse(normalizeSiteNavigationTargets(site.siteSettings, pages)),
    pages,
  });
}

function migrateV9Project(project: z.infer<typeof ProjectRecordV9Schema>): ProjectRecord {
  const siteSettings = SiteSettingsV10Schema.parse(normalizeSiteNavigationTargets(project.siteSettings, project.pages));
  return ProjectRecordSchema.parse({ ...project, siteSettings });
}

export function createProjectStorage({ storage, now = () => new Date(), createId = () => globalThis.crypto.randomUUID() }: ProjectStorageOptions) {
  function readCollection(): ProjectCollection {
    let raw: string | null;
    try {
      raw = storage.getItem(PROJECT_STORAGE_KEY);
    } catch {
      throw new ProjectStorageError("UNAVAILABLE");
    }
    if (raw === null) return { version: PROJECT_COLLECTION_VERSION, projects: [] };

    let value: unknown;
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      throw new ProjectStorageError("CORRUPT");
    }
    const current = ProjectCollectionSchema.safeParse(value);
    if (current.success) return current.data;
    const version9 = ProjectCollectionV9Schema.safeParse(value);
    if (version9.success) {
      return { version: PROJECT_COLLECTION_VERSION, projects: version9.data.projects.map(migrateV9Project) };
    }
    const version8 = ProjectCollectionV8Schema.safeParse(value);
    if (version8.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version8.data.projects.map((project) => migrateV9Project(ProjectRecordV9Schema.parse({
          ...project,
          siteSettings: project.siteSettings,
          pages: project.pages.map((page) => ({
            ...page,
            kind: inferSitePageKind(page, page.template.id),
          })),
        }))),
      };
    }
    const version7 = ProjectCollectionV7Schema.safeParse(value);
    if (version7.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version7.data.projects.map((project) => migrateLegacyProject(project)),
      };
    }
    const version6 = ProjectCollectionV6Schema.safeParse(value);
    if (version6.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version6.data.projects.map((project) => migrateLegacyProject(project)),
      };
    }
    const version5 = ProjectCollectionV5Schema.safeParse(value);
    if (version5.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version5.data.projects.map((project) => migrateLegacyProject(project)),
      };
    }
    const version4 = ProjectCollectionV4Schema.safeParse(value);
    if (version4.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version4.data.projects.map((project) => migrateLegacyProject({ ...project, template: DEFAULT_SITE_TEMPLATE })),
      };
    }
    const version2 = ProjectCollectionV2Schema.safeParse(value);
    if (version2.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version2.data.projects.map((project) => migrateLegacyProject({
          ...project,
          siteSettings: { ...project.siteSettings, appearance: DEFAULT_APPEARANCE },
          heroImage: null,
          template: DEFAULT_SITE_TEMPLATE,
        })),
      };
    }
    const version3 = ProjectCollectionV3Schema.safeParse(value);
    if (version3.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version3.data.projects.map((project) => migrateLegacyProject({ ...project, heroImage: null, template: DEFAULT_SITE_TEMPLATE })),
      };
    }
    const legacy = ProjectCollectionV1Schema.safeParse(value);
    if (legacy.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: legacy.data.projects.map((project) => migrateLegacyProject({ ...project, siteSettings: DEFAULT_SITE_SETTINGS, heroImage: null, template: DEFAULT_SITE_TEMPLATE })),
      };
    }
    throw new ProjectStorageError("CORRUPT");
  }

  function writeCollection(collection: ProjectCollection) {
    const validated = ProjectCollectionSchema.safeParse(collection);
    if (!validated.success) throw new ProjectStorageError("INVALID_INPUT");
    try {
      storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(validated.data));
    } catch (error) {
      throw new ProjectStorageError(isQuotaError(error) ? "QUOTA" : "UNAVAILABLE");
    }
  }

  function timestamp(after?: string) {
    try {
      const currentTime = now();
      if (!(currentTime instanceof Date) || !Number.isFinite(currentTime.getTime())) throw new Error();
      const value = new Date(currentTime.getTime());
      if (after) {
        const priorTime = Date.parse(after);
        if (!Number.isFinite(priorTime)) throw new Error();
        if (value.getTime() <= priorTime) value.setTime(priorTime + 1);
      }
      return value.toISOString();
    } catch {
      throw new ProjectStorageError("FAILED");
    }
  }

  function list(): ProjectRecord[] {
    return readCollection().projects.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function load(id: string): ProjectRecord {
    const projectId = parseInput(ProjectIdSchema, id);
    const project = readCollection().projects.find((item) => item.id === projectId);
    if (!project) throw new ProjectStorageError("NOT_FOUND");
    return project;
  }

  function create(name: string, snapshot: ProjectSnapshot): ProjectRecord {
    const projectName = parseInput(ProjectNameSchema, name);
    const projectSnapshot = parseInput(ProjectSnapshotSchema, snapshot);
    const collection = readCollection();
    const time = timestamp();
    let id: string;
    try {
      id = parseInput(ProjectIdSchema, createId());
    } catch (error) {
      if (error instanceof ProjectStorageError) throw error;
      throw new ProjectStorageError("FAILED");
    }
    if (collection.projects.some((project) => project.id === id)) throw new ProjectStorageError("CONFLICT");
    const project = ProjectRecordSchema.parse({
      id, name: projectName, ...projectSnapshot, createdAt: time, updatedAt: time, revision: 1,
    });
    writeCollection({ ...collection, projects: [...collection.projects, project] });
    return project;
  }

  function save(id: string, snapshot: ProjectSnapshot, expectedRevision: number): ProjectRecord {
    const projectId = parseInput(ProjectIdSchema, id);
    const projectSnapshot = parseInput(ProjectSnapshotSchema, snapshot);
    const collection = readCollection();
    const index = collection.projects.findIndex((project) => project.id === projectId);
    if (index < 0) throw new ProjectStorageError("NOT_FOUND");
    const current = collection.projects[index];
    if (!Number.isInteger(expectedRevision) || current.revision !== expectedRevision) throw new ProjectStorageError("CONFLICT");
    const updated = ProjectRecordSchema.parse({
      ...current, ...projectSnapshot, updatedAt: timestamp(current.updatedAt), revision: current.revision + 1,
    });
    const projects = collection.projects.slice();
    projects[index] = updated;
    writeCollection({ ...collection, projects });
    return updated;
  }

  function rename(id: string, name: string, expectedRevision: number): ProjectRecord {
    const projectId = parseInput(ProjectIdSchema, id);
    const projectName = parseInput(ProjectNameSchema, name);
    const collection = readCollection();
    const index = collection.projects.findIndex((project) => project.id === projectId);
    if (index < 0) throw new ProjectStorageError("NOT_FOUND");
    const current = collection.projects[index];
    if (!Number.isInteger(expectedRevision) || current.revision !== expectedRevision) throw new ProjectStorageError("CONFLICT");
    const updated = ProjectRecordSchema.parse({ ...current, name: projectName, updatedAt: timestamp(current.updatedAt), revision: current.revision + 1 });
    const projects = collection.projects.slice();
    projects[index] = updated;
    writeCollection({ ...collection, projects });
    return updated;
  }

  function remove(id: string, expectedRevision: number): void {
    const projectId = parseInput(ProjectIdSchema, id);
    const collection = readCollection();
    const current = collection.projects.find((project) => project.id === projectId);
    if (!current) throw new ProjectStorageError("NOT_FOUND");
    if (!Number.isInteger(expectedRevision) || current.revision !== expectedRevision) throw new ProjectStorageError("CONFLICT");
    writeCollection({ ...collection, projects: collection.projects.filter((project) => project.id !== projectId) });
  }

  return { list, create, load, save, rename, remove };
}

export type ProjectStorage = ReturnType<typeof createProjectStorage>;

export function projectSnapshotFromPages(
  brief: BusinessBrief,
  pages: ProjectPage[],
  layout: "editorial" | "split",
  siteSettings: SiteSettings = DEFAULT_SITE_SETTINGS,
  heroImage: HeroImageAsset | null = null,
): ProjectSnapshot {
  const normalizedSettings = SiteSettingsV10Schema.parse(normalizeSiteNavigationTargets(siteSettings, pages));
  return ProjectSnapshotSchema.parse({ brief, pages, layout, siteSettings: normalizedSettings, heroImage });
}

export function projectSnapshotFromPage(brief: BusinessBrief, page: {
  headline: string;
  subheadline: string;
  features: string[];
  callToAction: string;
}, layout: "editorial" | "split", siteSettings: SiteSettings = DEFAULT_SITE_SETTINGS, heroImage: HeroImageAsset | null = null, template: SiteTemplate = DEFAULT_SITE_TEMPLATE): ProjectSnapshot {
  return projectSnapshotFromPages(brief, [{
    id: "home",
    slug: "index",
    title: "Home",
    kind: "home",
    content: {
      headline: page.headline,
      description: page.subheadline,
      features: page.features,
      callToAction: page.callToAction,
    },
    template,
  }], layout, siteSettings, heroImage);
}

export function editablePageFromProject(project: ProjectRecord, pageId: string) {
  const record = project.pages.find((page) => page.id === pageId);
  if (!record) return null;
  return {
    ...project.brief,
    headline: record.content.headline,
    subheadline: record.content.description,
    features: record.content.features,
    callToAction: record.content.callToAction,
    layout: project.layout,
  };
}

export function pageFromProject(project: ProjectRecord) {
  return editablePageFromProject(project, "home")!;
}

export function siteTemplateFromProject(project: ProjectRecord): SiteTemplate {
  return project.pages.find((page) => page.id === "home")!.template;
}

export function siteSettingsFromProject(project: ProjectRecord): SiteSettings {
  return project.siteSettings;
}
