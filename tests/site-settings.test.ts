import { describe, expect, it } from "vitest";
import { VISUAL_STYLES } from "@/lib/generation";
import {
  AppearanceSchema,
  DEFAULT_APPEARANCE,
  DEFAULT_SITE_SETTINGS,
  SiteDestinationSchema,
  SiteSettingsSchema,
  SITE_STYLE_PALETTES,
  TypographySchema,
  contrastRatio,
  resolveEffectiveAppearance,
  validateAppearanceContrast,
  validateSiteDestination,
} from "@/lib/site-settings";

describe("appearance settings", () => {
  it("retains strict navigation settings and validates safe destinations", () => {
    expect(SiteSettingsSchema.safeParse(DEFAULT_SITE_SETTINGS).success).toBe(true);
    expect(SiteSettingsSchema.safeParse({ ...DEFAULT_SITE_SETTINGS, navigation: DEFAULT_SITE_SETTINGS.navigation.slice(0, 2) }).success).toBe(false);
    expect(SiteSettingsSchema.safeParse({ ...DEFAULT_SITE_SETTINGS, extra: true }).success).toBe(false);
    for (const destination of ["", "https://example.com/path?a=1&b=2", "http://localhost:3000/page", "#top", "#site-headline"]) {
      expect(SiteDestinationSchema.safeParse(destination).success, destination).toBe(true);
    }
    expect(validateSiteDestination("")).toBeUndefined();
    expect(validateSiteDestination("#top")).toBe("#top");
    expect(validateSiteDestination("https://example.com")).toBe("https://example.com/");
    for (const destination of ["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "//example.com", "\\\\example.com", "https://user:pass@example.com", "#contact", "https://example.com/\npath", "\thttps://example.com"]) {
      expect(SiteDestinationSchema.safeParse(destination).success, destination).toBe(false);
    }
  });

  it("validates strict color overrides and curated typography values", () => {
    expect(AppearanceSchema.safeParse(DEFAULT_APPEARANCE).success).toBe(true);
    expect(AppearanceSchema.safeParse({ colors: { primary: "#Aa00FF", background: null, accent: "#ffffff" }, typography: "editorial-serif" }).success).toBe(true);
    expect(AppearanceSchema.safeParse({ colors: { primary: "red", background: null, accent: null }, typography: "preset" }).success).toBe(false);
    expect(AppearanceSchema.safeParse({ colors: { primary: "#12345678", background: null, accent: null }, typography: "preset" }).success).toBe(false);
    expect(AppearanceSchema.safeParse({ colors: { primary: null, background: null, accent: null }, typography: "Comic Sans" }).success).toBe(false);
    expect(TypographySchema.safeParse("system-sans").success).toBe(true);
    expect(TypographySchema.safeParse("url(https://invalid.test/font)").success).toBe(false);
  });

  it("resolves style preset colors and typography for all five styles", () => {
    for (const style of VISUAL_STYLES) {
      const resolved = resolveEffectiveAppearance(style, DEFAULT_APPEARANCE);
      expect(resolved.colors).toEqual(SITE_STYLE_PALETTES[style]);
      expect(resolved.bodyFont).toBe("Arial, Helvetica, sans-serif");
      expect(resolved.headingFont).toBe(style === "Bold" || style === "Professional" ? "Arial, Helvetica, sans-serif" : "Georgia, 'Times New Roman', serif");
      expect(validateAppearanceContrast(style, DEFAULT_APPEARANCE).valid).toBe(true);
      expect(validateAppearanceContrast(style, DEFAULT_APPEARANCE).normalText).toBeGreaterThanOrEqual(4.5);
    }
    expect(validateAppearanceContrast("Minimalist", DEFAULT_APPEARANCE).accentControl).toBeLessThan(3);
    expect(validateAppearanceContrast("Professional", DEFAULT_APPEARANCE).accentControl).toBeLessThan(3);
    expect(validateAppearanceContrast("Luxury", DEFAULT_APPEARANCE).accentControl).toBeGreaterThanOrEqual(3);
    expect(validateAppearanceContrast("Bold", DEFAULT_APPEARANCE).accentControl).toBeGreaterThanOrEqual(3);
    expect(validateAppearanceContrast("Playful", DEFAULT_APPEARANCE).accentControl).toBeGreaterThanOrEqual(3);
  });

  it("preserves explicit overrides across styles and reports contrast failures", () => {
    const appearance = { colors: { primary: "#111111", background: null, accent: "#777777" }, typography: "system-sans" as const };
    const resolved = resolveEffectiveAppearance("Luxury", appearance);
    expect(resolved.colors.primary).toBe("#111111");
    expect(resolved.colors.background).toBe(SITE_STYLE_PALETTES.Luxury.background);
    expect(resolved.colors.accent).toBe("#777777");
    expect(resolved.bodyFont).toBe("Arial, Helvetica, sans-serif");
    const invalid = validateAppearanceContrast("Minimalist", { colors: { primary: "#777777", background: "#888888", accent: null }, typography: "preset" });
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.length).toBeGreaterThan(0);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("does not reject an accent used decoratively when text and CTA contrast pass", () => {
    const result = validateAppearanceContrast("Minimalist", { colors: { primary: "#111111", background: "#FFFFFF", accent: "#EEEEEE" }, typography: "preset" });
    expect(result.valid).toBe(true);
  });
});
