import { z } from "zod";

export const SAFE_SITE_ANCHORS = ["#top", "#site-headline"] as const;

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
}).strict();

export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  navigation: [
    { label: "Our story", destination: "" },
    { label: "Collections", destination: "" },
    { label: "Journal", destination: "" },
  ],
  ctaDestination: "",
};
