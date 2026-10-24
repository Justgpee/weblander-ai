import { describe, expect, it } from "vitest";
import { appearanceColorControlKey, clearHexColorOverride, HEX_COLOR_DRAFT_ERROR_MESSAGE, normalizeHexColorDraft, selectHexColor, shouldShowHexColorDraftError, updateHexColorDraft } from "@/lib/appearance-color-draft";

describe("appearance HEX color drafts", () => {
  it("uses the approved concise validation wording", () => {
    expect(HEX_COLOR_DRAFT_ERROR_MESSAGE).toBe("Please enter a valid HEX color code (e.g., #456B52).");
  });

  it.each([
    ["#A1B2C3", "#A1B2C3"],
    ["#a1b2c3", "#A1B2C3"],
    ["#aBcDeF", "#ABCDEF"],
  ])("normalizes valid input %s", (input, expected) => {
    expect(normalizeHexColorDraft(input)).toBe(expected);
  });

  it.each(["", "#", "#123", "123456", "#1234567", "#GGGGGG"])("rejects incomplete or invalid input %s", (input) => {
    expect(normalizeHexColorDraft(input)).toBeNull();
  });

  it("keeps invalid drafts local and preserves the prior committed override", () => {
    expect(updateHexColorDraft("#112233", "#11")).toEqual({
      draft: "#11",
      committedColor: "#112233",
      valid: false,
    });
    expect(updateHexColorDraft(null, "#")).toEqual({ draft: "#", committedColor: null, valid: false });
  });

  it("shows feedback for a complete malformed value but defers incomplete drafts until blur", () => {
    expect(shouldShowHexColorDraftError("#12", false)).toBe(false);
    expect(shouldShowHexColorDraftError("#12", true)).toBe(true);
    expect(shouldShowHexColorDraftError("#12GG45", false)).toBe(true);

    const invalid = updateHexColorDraft("#112233", "#12GG45");
    expect(invalid).toEqual({ draft: "#12GG45", committedColor: "#112233", valid: false });
    expect(shouldShowHexColorDraftError(invalid.draft, false)).toBe(true);

    const corrected = updateHexColorDraft(invalid.committedColor, "#abcdef");
    expect(corrected).toEqual({ draft: "#abcdef", committedColor: "#ABCDEF", valid: true });
    expect(shouldShowHexColorDraftError(corrected.draft, false)).toBe(false);
  });

  it("synchronizes a valid HEX edit or picker selection to its normalized committed color", () => {
    expect(updateHexColorDraft(null, "#a1b2c3")).toEqual({
      draft: "#a1b2c3",
      committedColor: "#A1B2C3",
      valid: true,
    });
    expect(selectHexColor("#c3b2a1")).toEqual({
      draft: "#C3B2A1",
      committedColor: "#C3B2A1",
      valid: true,
    });
  });

  it("clears the saved override while restoring the style default in the input", () => {
    expect(clearHexColorOverride("#456b52")).toEqual({
      draft: "#456B52",
      committedColor: null,
      valid: true,
    });
  });

  it("resets every color control's local draft identity on a full appearance reset", () => {
    for (const color of ["primary", "background", "accent"]) {
      expect(appearanceColorControlKey(color, 1)).not.toBe(appearanceColorControlKey(color, 2));
    }
    expect(appearanceColorControlKey("primary", 2)).not.toBe(appearanceColorControlKey("background", 2));
  });
});
