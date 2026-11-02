import { describe, expect, it } from "vitest";
import { VISUAL_STYLES } from "@/lib/generation";
import {
  DEFAULT_APPEARANCE,
  SITE_STYLE_PALETTES,
  resolveEffectiveAppearance,
} from "@/lib/site-settings";
import {
  resolveSiteStyleTokens,
  SITE_STYLE_PRESETS,
  SITE_STYLE_PRESET_NAMES,
  SiteStylePresetMapSchema,
  SiteStyleTokensSchema,
  siteStyleTokensCss,
  validateSiteStylePresetMap,
} from "@/lib/site-style-system";

describe("shared visual style token contract", () => {
  it("defines complete, validated tokens for every existing style", () => {
    expect(SITE_STYLE_PRESET_NAMES).toEqual(VISUAL_STYLES);
    expect(Object.keys(validateSiteStylePresetMap())).toEqual([...VISUAL_STYLES]);

    for (const style of VISUAL_STYLES) {
      const tokens = resolveSiteStyleTokens(style);
      expect(SiteStyleTokensSchema.safeParse(tokens).success, style).toBe(true);
      expect(tokens.colors).toEqual(SITE_STYLE_PALETTES[style]);
      expect(tokens.fontStacks.heading).toBeTruthy();
      expect(tokens.fontStacks.body).toBeTruthy();
      expect(tokens.contentWidthCh).toBeGreaterThanOrEqual(56);
      expect(tokens.contentWidthCh).toBeLessThanOrEqual(84);
    }
  });

  it("resolves deterministically", () => {
    for (const style of VISUAL_STYLES) {
      expect(resolveSiteStyleTokens(style)).toEqual(resolveSiteStyleTokens(style));
      expect(resolveSiteStyleTokens(style, DEFAULT_APPEARANCE)).toEqual(resolveSiteStyleTokens(style));
    }
  });

  it("encodes each intended visual identity in non-color tokens", () => {
    const minimalist = resolveSiteStyleTokens("Minimalist");
    expect(minimalist.fontStacks.heading).toBe("Georgia, 'Times New Roman', serif");
    expect(minimalist.headingWeight).toBe(300);
    expect(minimalist.density).toBe("airy");
    expect(minimalist.spacing).toBe("generous");
    expect(minimalist.decoration).toBe("restrained");

    const luxury = resolveSiteStyleTokens("Luxury");
    expect(luxury.fontStacks).toEqual({ heading: "Georgia, 'Times New Roman', serif", body: "Arial, Helvetica, sans-serif" });
    expect(luxury.borderStyle).toBe("double");
    expect(luxury.imageTreatment).toBe("premium-frame");
    expect(luxury.decoration).toBe("refined");

    const bold = resolveSiteStyleTokens("Bold");
    expect(bold.headingWeight).toBe(800);
    expect(bold.typeScale).toBe("display");
    expect(bold.borderStyle).toBe("heavy");
    expect(bold.buttonTreatment).toBe("block");
    expect(bold.composition).toBe("asymmetric");

    const playful = resolveSiteStyleTokens("Playful");
    expect(playful.fontStacks.heading).toBe("Georgia, 'Times New Roman', serif");
    expect(playful.cornerRadius).toBe("organic");
    expect(playful.buttonTreatment).toBe("pill");
    expect(playful.decoration).toBe("expressive");

    const professional = resolveSiteStyleTokens("Professional");
    expect(professional.composition).toBe("structured");
    expect(professional.density).toBe("structured");
    expect(professional.navigationTreatment).toBe("structured");
    expect(professional.imageTreatment).toBe("clean-frame");
  });

  it("keeps Minimalist and Professional meaningfully distinct beyond color", () => {
    const minimalist = resolveSiteStyleTokens("Minimalist");
    const professional = resolveSiteStyleTokens("Professional");
    expect(minimalist.fontStacks.heading).not.toBe(professional.fontStacks.heading);
    expect(minimalist.headingWeight).not.toBe(professional.headingWeight);
    expect(minimalist.density).not.toBe(professional.density);
    expect(minimalist.composition).not.toBe(professional.composition);
    expect(minimalist.buttonTreatment).not.toBe(professional.buttonTreatment);
    expect(minimalist.decoration).not.toBe(professional.decoration);
  });

  it("uses only finite token values and curated local font stacks", () => {
    const tokens = resolveSiteStyleTokens("Bold");
    expect(SiteStyleTokensSchema.safeParse({ ...tokens, buttonTreatment: "url(https://bad.test)" }).success).toBe(false);
    expect(SiteStyleTokensSchema.safeParse({ ...tokens, fontStacks: { ...tokens.fontStacks, heading: "url(https://bad.test)" } }).success).toBe(false);
    expect(SiteStyleTokensSchema.safeParse({ ...tokens, colors: { ...tokens.colors, primary: "red; background:url(https://bad.test)" } }).success).toBe(false);
    expect(SiteStyleTokensSchema.safeParse({ ...tokens, unexpected: "injected" }).success).toBe(false);
    expect(SiteStylePresetMapSchema.safeParse({ ...SITE_STYLE_PRESETS, Extra: SITE_STYLE_PRESETS.Bold }).success).toBe(false);
  });

  it("maps each style to concrete CSS properties, including non-color identity", () => {
    const resolved = Object.fromEntries(VISUAL_STYLES.map((style) => [style, siteStyleTokensCss(style)]));
    for (const style of VISUAL_STYLES) {
      const css = resolved[style] as string;
      expect(css).toContain(`--site-heading-weight:${resolveSiteStyleTokens(style).headingWeight}`);
      expect(css).toContain("--site-heading-size:clamp(");
      expect(css).toContain(`--site-ink:${SITE_STYLE_PALETTES[style].primary}`);
      expect(css).toContain("--site-button-bg:");
      expect(css).toContain("--site-nav-transform:");
      expect(css).toContain("--site-image-radius:");
    }

    const minimalist = resolved.Minimalist as string;
    const professional = resolved.Professional as string;
    for (const variable of ["--site-serif", "--site-heading-weight", "--site-heading-size", "--site-section-space", "--site-card-gap", "--site-hero-align", "--site-radius", "--site-button-radius", "--site-nav-tracking"]) {
      expect(minimalist).toContain(`${variable}:`);
      expect(professional).toContain(`${variable}:`);
    }
    expect(minimalist).not.toBe(professional);
  });

  it("does not allow appearance values to inject arbitrary CSS", () => {
    expect(() => siteStyleTokensCss("Minimalist", {
      ...DEFAULT_APPEARANCE,
      typography: "url(https://bad.test)" as never,
    })).toThrow();
    const invalid = { ...resolveSiteStyleTokens("Minimalist"), cornerRadius: "0px; background:url(https://bad.test)" };
    expect(SiteStyleTokensSchema.safeParse(invalid).success).toBe(false);
  });

  it("preserves existing appearance resolution and custom overrides", () => {
    const appearance = {
      colors: { primary: "#102030", background: null, accent: "#405060" },
      typography: "humanist-sans" as const,
    };
    const expectedAppearance = resolveEffectiveAppearance("Luxury", appearance);
    const tokens = resolveSiteStyleTokens("Luxury", appearance);
    expect(tokens.colors).toEqual(expectedAppearance.colors);
    expect(tokens.colors.background).toBe(SITE_STYLE_PALETTES.Luxury.background);
    expect(tokens.colors.primary).toBe("#102030");
    expect(tokens.colors.accent).toBe("#405060");
    expect(tokens.fontStacks).toEqual({ heading: expectedAppearance.headingFont, body: expectedAppearance.bodyFont });
    expect(tokens.fontStacks.heading).toBe("'Trebuchet MS', Arial, sans-serif");
    expect(tokens.fontStacks.body).toBe("'Trebuchet MS', Arial, sans-serif");
  });
});
