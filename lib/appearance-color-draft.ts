import { AppearanceSchema } from "@/lib/site-settings";

const HexColorSchema = AppearanceSchema.shape.colors.shape.primary;
export const HEX_COLOR_DRAFT_ERROR_MESSAGE = "Please enter a valid HEX color code (e.g., #456B52).";

/** Scope a color input's local draft to the full-reset revision. */
export function appearanceColorControlKey(colorKey: string, resetRevision: number): string {
  return `${colorKey}:${resetRevision}`;
}

export type HexColorDraftResult = {
  draft: string;
  committedColor: string | null;
  valid: boolean;
};

/** Parse a complete six-digit HEX value using the persisted appearance schema. */
export function normalizeHexColorDraft(value: string): string | null {
  const parsed = HexColorSchema.safeParse(value);
  return parsed.success && parsed.data !== null ? parsed.data.toUpperCase() : null;
}

/** Show complete malformed values immediately; defer incomplete drafts until blur. */
export function shouldShowHexColorDraftError(draft: string, touched: boolean): boolean {
  return normalizeHexColorDraft(draft) === null && (touched || draft.length >= 7);
}

/** Invalid drafts stay visible but retain the previous committed color. */
export function updateHexColorDraft(currentColor: string | null, draft: string): HexColorDraftResult {
  const normalized = normalizeHexColorDraft(draft);
  return {
    draft,
    committedColor: normalized ?? currentColor,
    valid: normalized !== null,
  };
}

/** Picker values are complete HEX colors and synchronize both editor controls. */
export function selectHexColor(value: string): HexColorDraftResult {
  const normalized = normalizeHexColorDraft(value);
  if (normalized === null) throw new Error("The color picker returned an invalid HEX color.");
  return { draft: normalized, committedColor: normalized, valid: true };
}

/** Clearing an override restores the displayed preset color without persisting it. */
export function clearHexColorOverride(presetColor: string): HexColorDraftResult {
  const normalized = normalizeHexColorDraft(presetColor);
  if (normalized === null) throw new Error("The style preset contains an invalid HEX color.");
  return { draft: normalized, committedColor: null, valid: true };
}
