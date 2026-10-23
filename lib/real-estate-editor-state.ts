import { RealEstateContentSchema, type RealEstateContent } from "@/lib/site-templates";

export type RealEstateContentDraft = {
  featuredProperties: Array<{ name: string; description: string }>;
  agencyStory: string;
};

export type RealEstateContentDraftValidation =
  | { success: true; data: RealEstateContent; errors: [] }
  | { success: false; data: null; errors: string[] };

export function realEstateEditorInstanceKey(projectId: string | null, templateId: string, revision: number) {
  return `${projectId ?? "draft"}:${templateId}:${revision}`;
}

export function realEstateContentToDraft(content: RealEstateContent): RealEstateContentDraft {
  return {
    featuredProperties: content.featuredProperties.map(({ name, description }) => ({ name, description })),
    agencyStory: content.agencyStory ?? "",
  };
}

export function validateRealEstateContentDraft(draft: RealEstateContentDraft): RealEstateContentDraftValidation {
  const agencyStory = draft.agencyStory.trim();
  const candidate = {
    featuredProperties: draft.featuredProperties.map(({ name, description }) => ({ name: name.trim(), description: description.trim() })),
    ...(agencyStory ? { agencyStory } : {}),
  };
  const result = RealEstateContentSchema.safeParse(candidate);
  if (result.success) return { success: true, data: result.data, errors: [] };

  const errors = new Set<string>();
  for (const issue of result.error.issues) {
    const [section, index, field] = issue.path;
    if (section === "featuredProperties" && typeof index === "number") {
      if (field === "name") errors.add(`Featured property ${index + 1} name must be 1–80 characters.`);
      else if (field === "description") errors.add(`Featured property ${index + 1} description must be 1–200 characters.`);
      else errors.add("Keep between two and four featured property highlights.");
    } else if (section === "featuredProperties") {
      errors.add("Keep between two and four featured property highlights.");
    } else if (section === "agencyStory") {
      errors.add("Agency story must be 1–600 characters, or blank.");
    }
  }
  return { success: false, data: null, errors: [...errors] };
}
