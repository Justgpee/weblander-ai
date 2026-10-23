import { describe, expect, it } from "vitest";
import { realEstateContentToDraft, realEstateEditorInstanceKey, validateRealEstateContentDraft, type RealEstateContentDraft } from "@/lib/real-estate-editor-state";

const validDraft: RealEstateContentDraft = {
  featuredProperties: [
    { name: "Thoughtful city living", description: "A residential property concept grounded in the supplied agency brief." },
    { name: "Room for a new chapter", description: "A second descriptive highlight shaped by the business's stated focus." },
  ],
  agencyStory: "An independent agency offering clear, considered property guidance.",
};

describe("Real Estate editor draft validation", () => {
  it("initializes from strict content and accepts edited names and descriptions without mutating the source", () => {
    const content = { featuredProperties: validDraft.featuredProperties, agencyStory: validDraft.agencyStory };
    const draft = realEstateContentToDraft(content);
    draft.featuredProperties[0].name = "Edited property concept";
    draft.featuredProperties[0].description = "Edited copy grounded in the agency brief.";

    expect(content.featuredProperties[0]).toEqual({
      name: "Thoughtful city living",
      description: "A residential property concept grounded in the supplied agency brief.",
    });
    expect(validateRealEstateContentDraft(draft)).toEqual({
      success: true,
      errors: [],
      data: { ...draft, featuredProperties: draft.featuredProperties },
    });
  });

  it("supports two to four highlights and reports invalid counts", () => {
    const three = { ...validDraft, featuredProperties: [...validDraft.featuredProperties, { name: "Quiet surroundings", description: "A property concept described using only supplied business details." }] };
    const four = { ...three, featuredProperties: [...three.featuredProperties, { name: "Flexible spaces", description: "A further descriptive highlight grounded in the agency's brief." }] };
    expect(validateRealEstateContentDraft(three).success).toBe(true);
    expect(validateRealEstateContentDraft(four).success).toBe(true);
    expect(validateRealEstateContentDraft({ ...validDraft, featuredProperties: validDraft.featuredProperties.slice(0, 1) }).errors)
      .toContain("Keep between two and four featured property highlights.");
    expect(validateRealEstateContentDraft({ ...four, featuredProperties: [...four.featuredProperties, four.featuredProperties[0]] }).errors)
      .toContain("Keep between two and four featured property highlights.");
  });

  it("keeps overlong and blank required drafts intact while preventing valid content updates", () => {
    const overlongName = { ...validDraft, featuredProperties: [{ name: "n".repeat(81), description: "A valid description grounded in the agency brief." }, validDraft.featuredProperties[1]] };
    const overlongDescription = { ...validDraft, featuredProperties: [{ name: "Property concept", description: "d".repeat(201) }, validDraft.featuredProperties[1]] };
    expect(validateRealEstateContentDraft(overlongName).errors).toContain("Featured property 1 name must be 1–80 characters.");
    expect(overlongName.featuredProperties[0].name).toHaveLength(81);
    expect(validateRealEstateContentDraft(overlongDescription).errors).toContain("Featured property 1 description must be 1–200 characters.");
    expect(overlongDescription.featuredProperties[0].description).toHaveLength(201);
    expect(validateRealEstateContentDraft({ ...validDraft, featuredProperties: [{ name: "  ", description: "A valid description." }, validDraft.featuredProperties[1]] }).success).toBe(false);
  });

  it("omits a cleared optional agency story and validates supplied story length", () => {
    expect(validateRealEstateContentDraft({ ...validDraft, agencyStory: "   " })).toEqual({
      success: true,
      errors: [],
      data: { featuredProperties: validDraft.featuredProperties },
    });
    expect(validateRealEstateContentDraft({ ...validDraft, agencyStory: "s".repeat(601) }).errors)
      .toContain("Agency story must be 1–600 characters, or blank.");
    expect(realEstateContentToDraft({ featuredProperties: validDraft.featuredProperties })).toEqual({
      ...validDraft,
      agencyStory: "",
    });
  });

  it("resets draft identity only when the active project, template, or template revision changes", () => {
    const currentKey = realEstateEditorInstanceKey("project-a", "real-estate", 3);
    expect(realEstateEditorInstanceKey("project-a", "real-estate", 3)).toBe(currentKey);
    expect(realEstateEditorInstanceKey("project-b", "real-estate", 3)).not.toBe(currentKey);
    expect(realEstateEditorInstanceKey("project-a", "real-estate", 4)).not.toBe(currentKey);
    expect(realEstateEditorInstanceKey(null, "real-estate", 3)).not.toBe(currentKey);
  });
});
