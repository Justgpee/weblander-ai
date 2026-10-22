import { z } from "zod";
import { BusinessBriefSchema, type BusinessBrief } from "@/lib/generation";
import { HeroImageAssetSchema, type HeroImageAsset } from "@/lib/site-image";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_SITE_SETTINGS,
  SiteSettingsSchema,
  SiteSettingsV2Schema,
  validateAppearanceContrast,
  type SiteSettings,
} from "@/lib/site-settings";

export const PROJECT_STORAGE_KEY = "weblander-ai:projects";
export const PROJECT_COLLECTION_VERSION = 4;

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

const ProjectSnapshotBaseSchema = z.object({
  brief: BusinessBriefSchema,
  content: ProjectPageContentSchema,
  layout: ProjectLayoutSchema,
  siteSettings: SiteSettingsSchema,
  heroImage: HeroImageAssetSchema.nullable(),
}).strict();
export const ProjectSnapshotSchema = ProjectSnapshotBaseSchema.superRefine((snapshot, context) => {
  const contrast = validateAppearanceContrast(snapshot.brief.style, snapshot.siteSettings.appearance);
  if (!contrast.valid) context.addIssue({ code: "custom", path: ["siteSettings", "appearance"], message: contrast.issues.join(" ") });
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
export const ProjectRecordV3Schema = withProjectTimeValidation({ ...ProjectRecordFields, siteSettings: SiteSettingsSchema });
const ProjectRecordV4BaseSchema = withProjectTimeValidation({ ...ProjectRecordFields, siteSettings: SiteSettingsSchema, heroImage: HeroImageAssetSchema.nullable() });
export const ProjectRecordSchema = ProjectRecordV4BaseSchema.superRefine((project, context) => {
  const contrast = validateAppearanceContrast(project.brief.style, project.siteSettings.appearance);
  if (!contrast.valid) context.addIssue({ code: "custom", path: ["siteSettings", "appearance"], message: contrast.issues.join(" ") });
});
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

export const ProjectCollectionSchema = z.object({
  version: z.literal(PROJECT_COLLECTION_VERSION),
  projects: z.array(ProjectRecordSchema),
}).strict().superRefine((collection, context) => validateUniqueProjectIds(collection.projects, context));

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
    const version2 = ProjectCollectionV2Schema.safeParse(value);
    if (version2.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version2.data.projects.map((project) => ({
          ...project,
          siteSettings: { ...project.siteSettings, appearance: DEFAULT_APPEARANCE },
          heroImage: null,
        })),
      };
    }
    const version3 = ProjectCollectionV3Schema.safeParse(value);
    if (version3.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: version3.data.projects.map((project) => ({ ...project, heroImage: null })),
      };
    }
    const legacy = ProjectCollectionV1Schema.safeParse(value);
    if (legacy.success) {
      return {
        version: PROJECT_COLLECTION_VERSION,
        projects: legacy.data.projects.map((project) => ({ ...project, siteSettings: DEFAULT_SITE_SETTINGS, heroImage: null })),
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

export function projectSnapshotFromPage(brief: BusinessBrief, page: {
  headline: string;
  subheadline: string;
  features: string[];
  callToAction: string;
}, layout: "editorial" | "split", siteSettings: SiteSettings = DEFAULT_SITE_SETTINGS, heroImage: HeroImageAsset | null = null): ProjectSnapshot {
  return ProjectSnapshotSchema.parse({
    brief,
    content: {
      headline: page.headline,
      description: page.subheadline,
      features: page.features,
      callToAction: page.callToAction,
    },
    layout,
    siteSettings,
    heroImage,
  });
}

export function pageFromProject(project: ProjectRecord) {
  return {
    ...project.brief,
    headline: project.content.headline,
    subheadline: project.content.description,
    features: project.content.features,
    callToAction: project.content.callToAction,
    layout: project.layout,
  };
}

export function siteSettingsFromProject(project: ProjectRecord): SiteSettings {
  return project.siteSettings;
}
