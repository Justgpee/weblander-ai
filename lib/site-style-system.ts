import { z } from "zod";
import { VISUAL_STYLES, VisualStyleSchema, type VisualStyle } from "@/lib/generation";
import {
  DEFAULT_APPEARANCE,
  resolveEffectiveAppearance,
  TYPOGRAPHY_STACKS,
  type Appearance,
} from "@/lib/site-settings";

const FontStackSchema = z.string().refine(
  (value) => Object.values(TYPOGRAPHY_STACKS).includes(value as (typeof TYPOGRAPHY_STACKS)[keyof typeof TYPOGRAPHY_STACKS]),
  "Font stacks must use a curated local system stack.",
);

const SiteStylePresetSchema = z.object({
  headingWeight: z.union([z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]),
  typeScale: z.enum(["restrained", "editorial", "display", "friendly", "structured"]),
  density: z.enum(["airy", "deliberate", "assertive", "lively", "structured"]),
  spacing: z.enum(["generous", "measured", "confident", "lively", "disciplined"]),
  composition: z.enum(["open", "editorial", "asymmetric", "expressive", "structured"]),
  contentWidthCh: z.number().int().min(56).max(84),
  borderStyle: z.enum(["none", "hairline", "double", "heavy", "solid"]),
  cornerRadius: z.enum(["square", "subtle", "rounded", "organic"]),
  shadow: z.enum(["none", "soft", "layered"]),
  buttonTreatment: z.enum(["text", "outlined", "solid", "block", "pill"]),
  navigationTreatment: z.enum(["quiet", "editorial", "strong", "friendly", "structured"]),
  imageTreatment: z.enum(["unframed", "premium-frame", "graphic-frame", "organic-frame", "clean-frame"]),
  decoration: z.enum(["restrained", "refined", "graphic", "expressive", "disciplined"]),
}).strict();

export type SiteStylePreset = z.infer<typeof SiteStylePresetSchema>;

/** Non-color preset identity. Palette values remain owned by site-settings.ts. */
export const SITE_STYLE_PRESETS = {
  Minimalist: {
    headingWeight: 300,
    typeScale: "restrained",
    density: "airy",
    spacing: "generous",
    composition: "open",
    contentWidthCh: 78,
    borderStyle: "hairline",
    cornerRadius: "square",
    shadow: "none",
    buttonTreatment: "outlined",
    navigationTreatment: "quiet",
    imageTreatment: "unframed",
    decoration: "restrained",
  },
  Luxury: {
    headingWeight: 400,
    typeScale: "editorial",
    density: "deliberate",
    spacing: "measured",
    composition: "editorial",
    contentWidthCh: 68,
    borderStyle: "double",
    cornerRadius: "subtle",
    shadow: "soft",
    buttonTreatment: "outlined",
    navigationTreatment: "editorial",
    imageTreatment: "premium-frame",
    decoration: "refined",
  },
  Bold: {
    headingWeight: 800,
    typeScale: "display",
    density: "assertive",
    spacing: "confident",
    composition: "asymmetric",
    contentWidthCh: 72,
    borderStyle: "heavy",
    cornerRadius: "square",
    shadow: "layered",
    buttonTreatment: "block",
    navigationTreatment: "strong",
    imageTreatment: "graphic-frame",
    decoration: "graphic",
  },
  Playful: {
    headingWeight: 600,
    typeScale: "friendly",
    density: "lively",
    spacing: "lively",
    composition: "expressive",
    contentWidthCh: 76,
    borderStyle: "solid",
    cornerRadius: "organic",
    shadow: "layered",
    buttonTreatment: "pill",
    navigationTreatment: "friendly",
    imageTreatment: "organic-frame",
    decoration: "expressive",
  },
  Professional: {
    headingWeight: 600,
    typeScale: "structured",
    density: "structured",
    spacing: "disciplined",
    composition: "structured",
    contentWidthCh: 72,
    borderStyle: "solid",
    cornerRadius: "subtle",
    shadow: "none",
    buttonTreatment: "solid",
    navigationTreatment: "structured",
    imageTreatment: "clean-frame",
    decoration: "disciplined",
  },
} as const satisfies Record<VisualStyle, SiteStylePreset>;

export const SiteStylePresetMapSchema = z.record(VisualStyleSchema, SiteStylePresetSchema);

/** Fully resolved tokens safe for later mapping to a fixed set of CSS variables. */
export const SiteStyleTokensSchema = SiteStylePresetSchema.extend({
  colors: z.object({
    primary: z.string().regex(/^#[\da-fA-F]{6}$/),
    background: z.string().regex(/^#[\da-fA-F]{6}$/),
    accent: z.string().regex(/^#[\da-fA-F]{6}$/),
  }).strict(),
  fontStacks: z.object({ heading: FontStackSchema, body: FontStackSchema }).strict(),
}).strict();

export type SiteStyleTokens = z.infer<typeof SiteStyleTokensSchema>;

const cssValues = {
  typeScale: {
    restrained: "clamp(38px, 5.6cqi, 72px)",
    editorial: "clamp(42px, 6.4cqi, 82px)",
    display: "clamp(48px, 8cqi, 96px)",
    friendly: "clamp(40px, 6.5cqi, 78px)",
    structured: "clamp(38px, 5.8cqi, 72px)",
  },
  spacing: {
    generous: "clamp(54px, 9cqi, 112px)",
    measured: "clamp(46px, 7cqi, 88px)",
    confident: "clamp(38px, 6cqi, 76px)",
    lively: "clamp(42px, 7cqi, 84px)",
    disciplined: "clamp(38px, 5.5cqi, 68px)",
  },
  density: {
    airy: "clamp(18px, 3cqi, 34px)",
    deliberate: "clamp(16px, 2.6cqi, 28px)",
    assertive: "clamp(12px, 2cqi, 22px)",
    lively: "clamp(14px, 2.4cqi, 26px)",
    structured: "clamp(10px, 1.8cqi, 20px)",
  },
  composition: { open: "center", editorial: "center", asymmetric: "center", expressive: "center", structured: "start" },
  borderStyle: { none: "none", hairline: "solid", double: "double", heavy: "solid", solid: "solid" },
  borderWidth: { none: "0px", hairline: "1px", double: "3px", heavy: "4px", solid: "1px" },
  radius: { square: "0px", subtle: "3px", rounded: "14px", organic: "24px 24px 8px 24px" },
  shadow: {
    none: "none",
    soft: "0 12px 30px color-mix(in srgb,var(--site-ink) 10%,transparent)",
    layered: "0 18px 32px color-mix(in srgb,var(--site-ink) 18%,transparent)",
  },
  buttonRadius: { text: "0px", outlined: "2px", solid: "3px", block: "0px", pill: "999px" },
  buttonWidth: { text: "0px", outlined: "1px", solid: "1px", block: "3px", pill: "1px" },
  buttonBackground: { text: "transparent", outlined: "transparent", solid: "var(--site-ink)", block: "var(--site-ink)", pill: "var(--site-ink)" },
  buttonColor: { text: "var(--site-ink)", outlined: "var(--site-ink)", solid: "var(--site-bg)", block: "var(--site-bg)", pill: "var(--site-bg)" },
  navTransform: { quiet: "none", editorial: "uppercase", strong: "uppercase", friendly: "none", structured: "uppercase" },
  navTracking: { quiet: "0.01em", editorial: "0.12em", strong: "0.08em", friendly: "0.01em", structured: "0.075em" },
  imageRadius: { unframed: "0px", "premium-frame": "50% 50% 2px 2px", "graphic-frame": "0px", "organic-frame": "38% 62% 24px 24px", "clean-frame": "4px" },
  imageShadow: {
    unframed: "none",
    "premium-frame": "0 16px 36px color-mix(in srgb,var(--site-ink) 18%,transparent)",
    "graphic-frame": "8px 8px 0 color-mix(in srgb,var(--site-accent) 70%,var(--site-bg))",
    "organic-frame": "0 14px 28px color-mix(in srgb,var(--site-ink) 16%,transparent)",
    "clean-frame": "0 4px 12px color-mix(in srgb,var(--site-ink) 9%,transparent)",
  },
  decorationOpacity: { restrained: "0.38", refined: "0.72", graphic: "1", expressive: "0.9", disciplined: "0.52" },
} as const;

const cssTokenEnums = {
  typeScale: Object.keys(cssValues.typeScale),
  spacing: Object.keys(cssValues.spacing),
  density: Object.keys(cssValues.density),
  composition: Object.keys(cssValues.composition),
  borderStyle: Object.keys(cssValues.borderStyle),
  cornerRadius: Object.keys(cssValues.radius),
  shadow: Object.keys(cssValues.shadow),
  buttonTreatment: Object.keys(cssValues.buttonRadius),
  navigationTreatment: Object.keys(cssValues.navTransform),
  imageTreatment: Object.keys(cssValues.imageRadius),
  decoration: Object.keys(cssValues.decorationOpacity),
} as const;

/** Converts validated token enums into fixed CSS values; no user CSS is accepted. */
export function siteStyleTokensCss(style: VisualStyle, appearance: Appearance = DEFAULT_APPEARANCE): string {
  const tokens = resolveSiteStyleTokens(style, appearance);
  // Guard the lookup table itself so adding a token enum requires an explicit CSS mapping.
  for (const key of Object.keys(cssTokenEnums) as (keyof typeof cssTokenEnums)[]) {
    if (!cssTokenEnums[key].includes(tokens[key] as never)) throw new Error(`Missing CSS mapping for ${key}.`);
  }
  const values = {
    "--site-ink": tokens.colors.primary,
    "--site-bg": tokens.colors.background,
    "--site-accent": tokens.colors.accent,
    "--site-serif": tokens.fontStacks.heading,
    "--site-body-font": tokens.fontStacks.body,
    "--site-heading-weight": String(tokens.headingWeight),
    "--site-heading-size": cssValues.typeScale[tokens.typeScale],
    "--site-content-width": `${tokens.contentWidthCh}ch`,
    "--site-section-space": cssValues.spacing[tokens.spacing],
    "--site-card-gap": cssValues.density[tokens.density],
    "--site-hero-align": cssValues.composition[tokens.composition],
    "--site-card-border-style": cssValues.borderStyle[tokens.borderStyle],
    "--site-card-border-width": cssValues.borderWidth[tokens.borderStyle],
    "--site-radius": cssValues.radius[tokens.cornerRadius],
    "--site-shadow": cssValues.shadow[tokens.shadow],
    "--site-button-radius": cssValues.buttonRadius[tokens.buttonTreatment],
    "--site-button-border-width": cssValues.buttonWidth[tokens.buttonTreatment],
    "--site-button-bg": cssValues.buttonBackground[tokens.buttonTreatment],
    "--site-button-color": cssValues.buttonColor[tokens.buttonTreatment],
    "--site-nav-transform": cssValues.navTransform[tokens.navigationTreatment],
    "--site-nav-tracking": cssValues.navTracking[tokens.navigationTreatment],
    "--site-image-radius": cssValues.imageRadius[tokens.imageTreatment],
    "--site-image-shadow": cssValues.imageShadow[tokens.imageTreatment],
    "--site-decoration-opacity": cssValues.decorationOpacity[tokens.decoration],
  };
  return Object.entries(values).map(([name, value]) => `${name}:${value}`).join(";");
}

/** Resolves identity tokens while delegating palette and user overrides to the existing appearance system. */
export function resolveSiteStyleTokens(
  style: VisualStyle,
  appearance: Appearance = DEFAULT_APPEARANCE,
): SiteStyleTokens {
  const validatedStyle = VisualStyleSchema.parse(style);
  const preset = SiteStylePresetSchema.parse(SITE_STYLE_PRESETS[validatedStyle]);
  const effectiveAppearance = resolveEffectiveAppearance(validatedStyle, appearance);

  return SiteStyleTokensSchema.parse({
    ...preset,
    colors: effectiveAppearance.colors,
    fontStacks: {
      heading: effectiveAppearance.headingFont,
      body: effectiveAppearance.bodyFont,
    },
  });
}

/** Runtime assertion used by tests and consumers to detect enum/preset drift. */
export function validateSiteStylePresetMap() {
  return SiteStylePresetMapSchema.parse(SITE_STYLE_PRESETS);
}

// Keep an explicit reference to the central style tuple for convenient typed consumers.
export const SITE_STYLE_PRESET_NAMES = VISUAL_STYLES;
