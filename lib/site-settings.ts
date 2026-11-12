import { z } from "zod";
import { SiteLogoAssetIdSchema } from "@/lib/site-logo";
import { VisualStyleSchema, type VisualStyle } from "@/lib/generation";

export const SAFE_SITE_ANCHORS = ["#top", "#site-headline", "#site-about", "#site-contact", "#site-story", "#site-menu", "#site-visit", "#site-collections", "#site-brand-story", "#site-properties", "#site-agency-story", "#site-services", "#site-products"] as const;

export const SITE_STYLE_PALETTES: Record<VisualStyle, { primary: string; background: string; accent: string }> = {
  Minimalist: { primary: "#283026", background: "#f1f0e9", accent: "#63745a" },
  Luxury: { primary: "#332b22", background: "#eee8dd", accent: "#9a7951" },
  Bold: { primary: "#362921", background: "#f1e5dc", accent: "#bd6346" },
  Playful: { primary: "#392b36", background: "#f4eaf0", accent: "#a16c91" },
  Professional: { primary: "#24333c", background: "#eaf0f2", accent: "#4e7786" },
};

export const TypographySchema = z.enum(["preset", "system-sans", "editorial-serif", "humanist-sans"]);
export type Typography = z.infer<typeof TypographySchema>;

const HexColorSchema = z.string().regex(/^#[\da-fA-F]{6}$/, "Use a six-digit hex color such as #456B52.").nullable();

export const AppearanceSchema = z.object({
  colors: z.object({
    primary: HexColorSchema,
    background: HexColorSchema,
    accent: HexColorSchema,
  }).strict(),
  typography: TypographySchema,
}).strict();
export type Appearance = z.infer<typeof AppearanceSchema>;

export const DEFAULT_APPEARANCE: Appearance = {
  colors: { primary: null, background: null, accent: null },
  typography: "preset",
};

export const TYPOGRAPHY_STACKS: Record<Exclude<Typography, "preset">, string> = {
  "system-sans": "Arial, Helvetica, sans-serif",
  "editorial-serif": "Georgia, 'Times New Roman', serif",
  "humanist-sans": "'Trebuchet MS', Arial, sans-serif",
};

export type EffectiveAppearance = {
  colors: { primary: string; background: string; accent: string };
  headingFont: string;
  bodyFont: string;
  hasColorOverrides: boolean;
};

export function resolveEffectiveAppearance(style: VisualStyle, appearance: Appearance): EffectiveAppearance {
  const validatedAppearance = AppearanceSchema.parse(appearance);
  const preset = SITE_STYLE_PALETTES[VisualStyleSchema.parse(style)];
  const colors = {
    primary: validatedAppearance.colors.primary ?? preset.primary,
    background: validatedAppearance.colors.background ?? preset.background,
    accent: validatedAppearance.colors.accent ?? preset.accent,
  };
  const presetHeading = style === "Bold" || style === "Professional"
    ? "Arial, Helvetica, sans-serif"
    : "Georgia, 'Times New Roman', serif";
  const chosenStack = validatedAppearance.typography === "preset" ? undefined : TYPOGRAPHY_STACKS[validatedAppearance.typography];
  return {
    colors,
    headingFont: chosenStack ?? presetHeading,
    bodyFont: chosenStack ?? "Arial, Helvetica, sans-serif",
    hasColorOverrides: Object.values(validatedAppearance.colors).some((color) => color !== null),
  };
}

function linearChannel(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const [red, green, blue] = hex.slice(1).match(/.{2}/g)!.map((value) => linearChannel(Number.parseInt(value, 16)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function blendForeground(foreground: string, background: string, opacity: number) {
  const foregroundChannels = foreground.slice(1).match(/.{2}/g)!.map((value) => Number.parseInt(value, 16));
  const backgroundChannels = background.slice(1).match(/.{2}/g)!.map((value) => Number.parseInt(value, 16));
  return `#${foregroundChannels.map((channel, index) => Math.round(channel * opacity + backgroundChannels[index] * (1 - opacity)).toString(16).padStart(2, "0")).join("")}`;
}

export type AppearanceContrast = {
  normalText: number;
  largeText: number;
  ctaText: number;
  accentControl: number;
  issues: string[];
  valid: boolean;
};

export function validateAppearanceContrast(style: VisualStyle, appearance: Appearance): AppearanceContrast {
  const effective = resolveEffectiveAppearance(style, appearance);
  const { primary, background, accent } = effective.colors;
  const normalText = contrastRatio(blendForeground(primary, background, 0.7), background);
  const largeText = contrastRatio(primary, background);
  const ctaText = contrastRatio(background, primary);
  const accentControl = contrastRatio(accent, primary);
  const hasColorOverrides = effective.hasColorOverrides;
  const issues: string[] = [];

  if (hasColorOverrides && normalText < 4.5) issues.push("Primary text needs at least 4.5:1 contrast against the background.");
  if (hasColorOverrides && largeText < 3) issues.push("Large primary text needs at least 3:1 contrast against the background.");
  if (hasColorOverrides && ctaText < 4.5) issues.push("Call-to-action text needs at least 4.5:1 contrast against its fill.");
  if ((appearance.colors.primary !== null || appearance.colors.accent !== null) && accentControl < 3) {
    issues.push("The accent border needs at least 3:1 contrast against the call-to-action fill.");
  }

  return { normalText, largeText, ctaText, accentControl, issues, valid: issues.length === 0 };
}

/** Existing preset borders below 3:1 stay visible when unrelated colors are customized. */
export function hasPreservedAccentBorderWarning(style: VisualStyle, appearance: Appearance) {
  return appearance.colors.primary === null
    && appearance.colors.accent === null
    && validateAppearanceContrast(style, appearance).accentControl < 3;
}

/** CSS variables are emitted only from validated hex values and fixed local stacks. */
export function effectiveAppearanceCss(style: VisualStyle, appearance: Appearance): string {
  const effective = resolveEffectiveAppearance(style, appearance);
  return [
    `--site-ink:${effective.colors.primary}`,
    `--site-bg:${effective.colors.background}`,
    `--site-accent:${effective.colors.accent}`,
    `--site-serif:${effective.headingFont}`,
    `--site-body-font:${effective.bodyFont}`,
  ].join(";");
}

function isSafeSiteDestination(value: string) {
  if (value === "" || (SAFE_SITE_ANCHORS as readonly string[]).includes(value)) return true;
  if (/^[\\/]{2}/.test(value) || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const SiteDestinationSchema = z.string().max(2048)
  .refine((value) => !/\p{Cc}/u.test(value), "Destinations cannot contain control characters.")
  .transform((value) => value.trim())
  .refine(isSafeSiteDestination, {
    message: "Enter an http(s) URL, a supported site section anchor, or leave the destination blank.",
  });

export function validateSiteDestination(value: string): string | undefined {
  const destination = SiteDestinationSchema.parse(value);
  if (!destination) return undefined;
  if ((SAFE_SITE_ANCHORS as readonly string[]).includes(destination)) return destination;
  return new URL(destination).href;
}

const NavigationPageIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const SafeExternalNavigationUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (!value || /^[\\/]{2}/.test(value) || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Enter a safe HTTP(S) URL without credentials.");

export const SiteNavigationTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z.object({ type: z.literal("external"), url: SafeExternalNavigationUrlSchema }).strict(),
  z.object({ type: z.literal("page"), pageId: NavigationPageIdSchema }).strict(),
  z.object({ type: z.literal("section"), pageId: NavigationPageIdSchema, anchor: z.enum(SAFE_SITE_ANCHORS) }).strict(),
  z.object({ type: z.literal("unresolved"), value: z.enum(SAFE_SITE_ANCHORS) }).strict(),
]);
export type SiteNavigationTarget = z.infer<typeof SiteNavigationTargetSchema>;

export const SiteCtaTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z.object({ type: z.literal("external"), url: SafeExternalNavigationUrlSchema }).strict(),
  z.object({ type: z.literal("current-section"), anchor: z.enum(SAFE_SITE_ANCHORS) }).strict(),
  z.object({ type: z.literal("page"), pageId: NavigationPageIdSchema }).strict(),
  z.object({ type: z.literal("section"), pageId: NavigationPageIdSchema, anchor: z.enum(SAFE_SITE_ANCHORS) }).strict(),
]);
export type SiteCtaTarget = z.infer<typeof SiteCtaTargetSchema>;

export const SiteLogoDisplayModeSchema = z.enum(["image-only", "image-with-name"]);
export type SiteLogoDisplayMode = z.infer<typeof SiteLogoDisplayModeSchema>;
export const SiteBrandingSchema = z.object({
  logoAssetId: SiteLogoAssetIdSchema.nullable(),
  logoDisplayMode: SiteLogoDisplayModeSchema,
}).strict();
export type SiteBranding = z.infer<typeof SiteBrandingSchema>;
export const DEFAULT_SITE_BRANDING: SiteBranding = { logoAssetId: null, logoDisplayMode: "image-with-name" };

export function siteCtaTargetFromLegacy(destination: string): SiteCtaTarget {
  const parsed = SiteDestinationSchema.parse(destination);
  if (!parsed) return { type: "none" };
  if (parsed.startsWith("http://") || parsed.startsWith("https://")) return { type: "external", url: new URL(parsed).href };
  return { type: "current-section", anchor: z.enum(SAFE_SITE_ANCHORS).parse(parsed) };
}

export function siteCtaTargetLegacyProjection(target: SiteCtaTarget): string {
  switch (target.type) {
    case "none":
    case "page":
    case "section": return "";
    case "external": return new URL(target.url).href;
    case "current-section": return target.anchor;
  }
}

export const SiteNavigationEntrySchema = z.object({
  label: z.string().trim().min(1).max(40),
  destination: SiteDestinationSchema,
  // Transitional studio projection retained until the navigation editor is
  // migrated. Persisted v10 records require a typed target below.
  target: SiteNavigationTargetSchema.optional(),
}).strict();

/** Frozen collection-v9 settings. Navigation destinations were safe strings. */
export const SiteSettingsV9Schema = z.object({
  navigation: z.tuple([
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema }).strict(),
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema }).strict(),
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema }).strict(),
  ]),
  ctaDestination: SiteDestinationSchema,
  appearance: AppearanceSchema,
}).strict();

/** Strict persisted collection-v10 shape. `destination` is a legacy projection
 * for current callers; `target` is authoritative and supports page navigation. */
function targetLegacyDestination(target: SiteNavigationTarget) {
  switch (target.type) {
    case "none":
    case "page": return "";
    case "external": return new URL(target.url).href;
    case "section": return target.pageId === "home" ? target.anchor : "";
    case "unresolved": return target.value;
  }
}

export const SiteSettingsV10Schema = z.object({
  navigation: z.tuple([
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema, target: SiteNavigationTargetSchema }).strict(),
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema, target: SiteNavigationTargetSchema }).strict(),
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema, target: SiteNavigationTargetSchema }).strict(),
  ]),
  ctaDestination: SiteDestinationSchema,
  appearance: AppearanceSchema,
}).strict().superRefine((settings, context) => {
  settings.navigation.forEach((entry, index) => {
    const destination = SiteDestinationSchema.parse(entry.destination);
    const compatibleDestination = targetLegacyDestination(entry.target);
    const matches = entry.target.type === "external"
      ? destination.startsWith("http://") || destination.startsWith("https://")
        ? new URL(destination).href === compatibleDestination
        : false
      : destination === compatibleDestination;
    if (!matches) context.addIssue({ code: "custom", path: ["navigation", index, "target"], message: "The compatibility destination must match its typed target." });
  });
});
export type SiteSettingsV10 = z.infer<typeof SiteSettingsV10Schema>;

/** Collection v11 adds an explicit, validated CTA destination discriminator. */
export const SiteSettingsV11Schema = SiteSettingsV10Schema.extend({
  ctaTarget: SiteCtaTargetSchema,
}).superRefine((settings, context) => {
  if (settings.ctaDestination !== siteCtaTargetLegacyProjection(settings.ctaTarget)) {
    context.addIssue({ code: "custom", path: ["ctaTarget"], message: "The compatibility destination must match its typed target." });
  }
});

/** Collection v12 adds a local asset reference and a validated logo display mode. */
export const SiteSettingsV12Schema = SiteSettingsV11Schema.extend({
  branding: SiteBrandingSchema,
});

export const SiteSettingsSchema = z.object({
  navigation: z.tuple([
    SiteNavigationEntrySchema,
    SiteNavigationEntrySchema,
    SiteNavigationEntrySchema,
  ]),
  ctaDestination: SiteDestinationSchema,
  ctaTarget: SiteCtaTargetSchema.optional(),
  appearance: AppearanceSchema,
  branding: SiteBrandingSchema.default(DEFAULT_SITE_BRANDING),
}).strict();

/** Strict shape of collection-v2 site settings, retained for migration only. */
export const SiteSettingsV2Schema = z.object({
  navigation: z.tuple([
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema }).strict(),
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema }).strict(),
    z.object({ label: z.string().trim().min(1).max(40), destination: SiteDestinationSchema }).strict(),
  ]),
  ctaDestination: SiteDestinationSchema,
}).strict();

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  navigation: [
    { label: "Our story", destination: "" },
    { label: "Collections", destination: "" },
    { label: "Journal", destination: "" },
  ],
  ctaDestination: "",
  appearance: DEFAULT_APPEARANCE,
  branding: DEFAULT_SITE_BRANDING,
};
