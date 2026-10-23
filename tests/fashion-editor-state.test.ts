import { describe, expect, it } from "vitest";
import { fashionContentToDraft, fashionEditorInstanceKey, validateFashionContentDraft, type FashionContentDraft } from "@/lib/fashion-editor-state";

const validDraft: FashionContentDraft = {
  collectionHighlights: [
    { name: "Everyday forms", description: "Considered pieces for everyday dressing." },
    { name: "Evening edit", description: "A refined direction for after-dark looks." },
  ],
  brandStory: "A small design studio shaped by thoughtful everyday wear.",
};

describe("fashion editor draft validation", () => {
  it("initializes from valid content and emits strict normalized content without mutating the source", () => {
    const content = { collectionHighlights: validDraft.collectionHighlights, brandStory: validDraft.brandStory };
    const draft = fashionContentToDraft(content);
    draft.collectionHighlights[0].name = "Everyday essentials";

    expect(content.collectionHighlights[0].name).toBe("Everyday forms");
    expect(validateFashionContentDraft({ ...draft, collectionHighlights: draft.collectionHighlights.map((item) => ({ ...item, name: ` ${item.name} ` })) })).toEqual({
      success: true,
      errors: [],
      data: { collectionHighlights: [{ ...draft.collectionHighlights[0], name: "Everyday essentials" }, draft.collectionHighlights[1]], brandStory: validDraft.brandStory },
    });
  });

  it("supports adding and removing highlights within the two-to-four bounds", () => {
    const three = { ...validDraft, collectionHighlights: [...validDraft.collectionHighlights, { name: "Weekend layers", description: "Relaxed layers for days off." }] };
    const four = { ...three, collectionHighlights: [...three.collectionHighlights, { name: "Studio pieces", description: "A focused edit for creative work." }] };
    expect(validateFashionContentDraft(three).success).toBe(true);
    expect(validateFashionContentDraft(four).success).toBe(true);
    expect(validateFashionContentDraft({ ...validDraft, collectionHighlights: validDraft.collectionHighlights.slice(0, 1) }).errors).toContain("Keep between two and four collection highlights.");
    expect(validateFashionContentDraft({ ...validDraft, collectionHighlights: [...four.collectionHighlights, four.collectionHighlights[0]] }).errors).toContain("Keep between two and four collection highlights.");
  });

  it("accepts edited names and descriptions and changes draft identity only for project/template revisions", () => {
    const edited = {
      ...validDraft,
      collectionHighlights: [
        { name: "Updated collection", description: "Updated collection direction and styling." },
        validDraft.collectionHighlights[1],
      ],
    };
    expect(validateFashionContentDraft(edited).data?.collectionHighlights[0]).toEqual(edited.collectionHighlights[0]);
    expect(fashionEditorInstanceKey("project-a", "fashion", 4)).toBe(fashionEditorInstanceKey("project-a", "fashion", 4));
    expect(fashionEditorInstanceKey("project-a", "fashion", 4)).not.toBe(fashionEditorInstanceKey("project-b", "fashion", 4));
    expect(fashionEditorInstanceKey("project-a", "fashion", 4)).not.toBe(fashionEditorInstanceKey("project-a", "fashion", 5));
  });

  it("reports overlong and blank required fields without truncating the draft", () => {
    const tooLong = { ...validDraft, collectionHighlights: [{ name: "n".repeat(61), description: "Valid description." }, validDraft.collectionHighlights[1]] };
    const invalidDescription = { ...validDraft, collectionHighlights: [{ name: "Capsule edit", description: "d".repeat(161) }, validDraft.collectionHighlights[1]] };
    expect(validateFashionContentDraft(tooLong).errors).toContain("Collection highlight 1 name must be 1–60 characters.");
    expect(tooLong.collectionHighlights[0].name).toHaveLength(61);
    expect(validateFashionContentDraft(invalidDescription).errors).toContain("Collection highlight 1 description must be 1–160 characters.");
    expect(validateFashionContentDraft({ ...validDraft, collectionHighlights: [{ name: "  ", description: "A valid description." }, validDraft.collectionHighlights[1]] }).success).toBe(false);
  });

  it("omits blank optional stories and validates supplied story lengths", () => {
    expect(validateFashionContentDraft({ ...validDraft, brandStory: "   " })).toEqual({
      success: true,
      errors: [],
      data: { collectionHighlights: validDraft.collectionHighlights },
    });
    expect(validateFashionContentDraft({ ...validDraft, brandStory: "s".repeat(601) }).errors).toContain("Brand story must be 1–600 characters, or blank.");
    expect(fashionContentToDraft({ collectionHighlights: validDraft.collectionHighlights })).toEqual({ ...validDraft, brandStory: "" });
  });
});
