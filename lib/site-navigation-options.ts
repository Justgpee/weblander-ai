import type { SiteTemplate } from "@/lib/site-templates";

export type SiteNavigationDestinationOption = {
  destination: string;
  label: string;
};

export const NO_SITE_DESTINATION = "__no_destination__";
export const CUSTOM_SITE_DESTINATION = "__custom_destination__";

/** Return only anchors for sections emitted by the shared website renderer. */
export function siteNavigationDestinationOptions(template: SiteTemplate): SiteNavigationDestinationOption[] {
  const options: SiteNavigationDestinationOption[] = [
    { destination: "#top", label: "Top of page" },
    { destination: "#site-headline", label: "Hero" },
  ];

  if (template.id === "restaurant") {
    options.push({ destination: "#site-menu", label: "Menu highlights" });
    if (template.content.story?.trim()) options.push({ destination: "#site-story", label: "Our story" });
    if (template.content.location?.trim() || template.content.openingHours?.trim()) {
      options.push({ destination: "#site-visit", label: "Visit information" });
    }
  } else if (template.id === "fashion") {
    options.push({ destination: "#site-collections", label: "Collections" });
    if (template.content.brandStory?.trim()) options.push({ destination: "#site-brand-story", label: "Brand story" });
  } else if (template.id === "real-estate") {
    options.push({ destination: "#site-properties", label: "Properties" });
    if (template.content.agencyStory?.trim()) options.push({ destination: "#site-agency-story", label: "Agency story" });
  }

  return options;
}

/** Treat destinations unavailable in this template as custom and preserve their value. */
export function siteNavigationDestinationSelection(destination: string, options: SiteNavigationDestinationOption[]) {
  if (!destination) return NO_SITE_DESTINATION;
  return options.some((option) => option.destination === destination)
    ? destination
    : CUSTOM_SITE_DESTINATION;
}
