import { FashionContentSchema, type FashionContent } from "@/lib/site-templates";

export type FashionContentDraft = {
  collectionHighlights: Array<{ name: string; description: string }>;
  brandStory: string;
};

export type FashionContentDraftValidation =
  | { success: true; data: FashionContent; errors: [] }
  | { success: false; data: null; errors: string[] };

export function fashionEditorInstanceKey(projectId: string | null, templateId: string, revision: number) {
  return `${projectId ?? "draft"}:${templateId}:${revision}`;
}

export function fashionContentToDraft(content: FashionContent): FashionContentDraft {
  return {
    collectionHighlights: content.collectionHighlights.map(({ name, description }) => ({ name, description })),
    brandStory: content.brandStory ?? "",
  };
}

export function validateFashionContentDraft(draft: FashionContentDraft): FashionContentDraftValidation {
  const brandStory = draft.brandStory.trim();
  const candidate = {
    collectionHighlights: draft.collectionHighlights.map(({ name, description }) => ({ name: name.trim(), description: description.trim() })),
    ...(brandStory ? { brandStory } : {}),
  };
  const result = FashionContentSchema.safeParse(candidate);
  if (result.success) return { success: true, data: result.data, errors: [] };

  const errors = new Set<string>();
  for (const issue of result.error.issues) {
    const [section, index, field] = issue.path;
    if (section === "collectionHighlights" && typeof index === "number") {
      if (field === "name") errors.add(`Collection highlight ${index + 1} name must be 1–60 characters.`);
      else if (field === "description") errors.add(`Collection highlight ${index + 1} description must be 1–160 characters.`);
      else errors.add("Keep between two and four collection highlights.");
    } else if (section === "collectionHighlights") {
      errors.add("Keep between two and four collection highlights.");
    } else if (section === "brandStory") {
      errors.add("Brand story must be 1–600 characters, or blank.");
    }
  }
  return { success: false, data: null, errors: [...errors] };
}
