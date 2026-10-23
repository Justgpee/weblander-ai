import { RestaurantContentSchema, type RestaurantContent } from "@/lib/site-templates";

export type RestaurantContentDraft = {
  menuHighlights: Array<{ name: string; description: string }>;
  story: string;
  location: string;
  openingHours: string;
};

export type RestaurantContentDraftValidation =
  | { success: true; data: RestaurantContent; errors: [] }
  | { success: false; data: null; errors: string[] };

export function restaurantContentToDraft(content: RestaurantContent): RestaurantContentDraft {
  return {
    menuHighlights: content.menuHighlights.map(({ name, description }) => ({ name, description })),
    story: content.story ?? "",
    location: content.location ?? "",
    openingHours: content.openingHours ?? "",
  };
}

export function validateRestaurantContentDraft(draft: RestaurantContentDraft): RestaurantContentDraftValidation {
  const optionalText = (value: string) => value.trim() || undefined;
  const story = optionalText(draft.story);
  const location = optionalText(draft.location);
  const openingHours = optionalText(draft.openingHours);
  const candidate = {
    menuHighlights: draft.menuHighlights.map(({ name, description }) => ({ name: name.trim(), description: description.trim() })),
    ...(story ? { story } : {}),
    ...(location ? { location } : {}),
    ...(openingHours ? { openingHours } : {}),
  };
  const result = RestaurantContentSchema.safeParse(candidate);
  if (result.success) return { success: true, data: result.data, errors: [] };

  const errors = new Set<string>();
  for (const issue of result.error.issues) {
    const [section, index, field] = issue.path;
    if (section === "menuHighlights" && typeof index === "number") {
      if (field === "name") errors.add(`Menu highlight ${index + 1} name must be 1–60 characters.`);
      else if (field === "description") errors.add(`Menu highlight ${index + 1} description must be 1–160 characters.`);
      else errors.add("Keep between two and four menu highlights.");
    } else if (section === "menuHighlights") {
      errors.add("Keep between two and four menu highlights.");
    } else if (section === "story") {
      errors.add("Story must be 1–600 characters, or blank.");
    } else if (section === "location") {
      errors.add("Location must be 1–240 characters, or blank.");
    } else if (section === "openingHours") {
      errors.add("Opening hours must be 1–240 characters, or blank.");
    }
  }
  return { success: false, data: null, errors: [...errors] };
}
