import { z } from "zod";
import { VisualStyleSchema, type VisualStyle } from "@/lib/generation";

export const SAFE_SITE_ANCHORS = ["#top", "#site-headline"] as const;

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
    message: "Enter an http(s) URL, #top, #site-headline, or leave the destination blank.",
  });

export function validateSiteDestination(value: string): string | undefined {
  const destination = SiteDestinationSchema.parse(value);
  if (!destination) return undefined;
  if ((SAFE_SITE_ANCHORS as readonly string[]).includes(destination)) return destination;
  return new URL(destination).href;
}

export const SiteNavigationEntrySchema = z.object({
  label: z.string().trim().min(1).max(40),
  destination: SiteDestinationSchema,
}).strict();

export const SiteSettingsSchema = z.object({
  navigation: z.tuple([
    SiteNavigationEntrySchema,
    SiteNavigationEntrySchema,
    SiteNavigationEntrySchema,
  ]),
  ctaDestination: SiteDestinationSchema,
  appearance: AppearanceSchema,
}).strict();

/** Strict shape of collection-v2 site settings, retained for migration only. */
export const SiteSettingsV2Schema = z.object({
  navigation: z.tuple([SiteNavigationEntrySchema, SiteNavigationEntrySchema, SiteNavigationEntrySchema]),
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
};
