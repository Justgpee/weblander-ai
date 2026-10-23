import { describe, expect, it } from "vitest";
import { restaurantContentToDraft, validateRestaurantContentDraft, type RestaurantContentDraft } from "@/lib/restaurant-editor-state";

const validDraft: RestaurantContentDraft = {
  menuHighlights: [
    { name: "Garden pasta", description: "Fresh pasta with seasonal vegetables and herbs." },
    { name: "Roasted carrots", description: "Slow-roasted carrots with a bright citrus dressing." },
  ],
  story: "A neighborhood kitchen shaped by seasonal cooking.",
  location: "North district",
  openingHours: "Tuesday to Sunday, 11 am to 9 pm",
};

describe("restaurant editor draft validation", () => {
  it("converts valid drafts to strict content and omits cleared optional fields", () => {
    const result = validateRestaurantContentDraft({ ...validDraft, story: " ", location: "", openingHours: "   " });
    expect(result).toEqual({
      success: true,
      errors: [],
      data: { menuHighlights: validDraft.menuHighlights },
    });
  });

  it("requires two to four valid dishes and enforces per-field lengths", () => {
    expect(validateRestaurantContentDraft({ ...validDraft, menuHighlights: [validDraft.menuHighlights[0]] }).success).toBe(false);
    expect(validateRestaurantContentDraft({ ...validDraft, menuHighlights: Array.from({ length: 5 }, () => validDraft.menuHighlights[0]) }).success).toBe(false);
    expect(validateRestaurantContentDraft({ ...validDraft, menuHighlights: [{ name: "", description: "A valid description." }, validDraft.menuHighlights[1]] }).errors)
      .toContain("Menu highlight 1 name must be 1–60 characters.");
    expect(validateRestaurantContentDraft({ ...validDraft, menuHighlights: [{ name: "A dish", description: "d".repeat(161) }, validDraft.menuHighlights[1]] }).errors)
      .toContain("Menu highlight 1 description must be 1–160 characters.");
    expect(validateRestaurantContentDraft({ ...validDraft, story: "s".repeat(601) }).errors).toContain("Story must be 1–600 characters, or blank.");
  });

  it("restores optional fields and menu entries from a persisted content value", () => {
    expect(restaurantContentToDraft({
      menuHighlights: validDraft.menuHighlights,
      location: validDraft.location,
    })).toEqual({
      menuHighlights: validDraft.menuHighlights,
      story: "",
      location: validDraft.location,
      openingHours: "",
    });
  });
});
