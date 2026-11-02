import type { SiteTemplate } from "@/lib/site-templates";
import { SiteDestinationSchema, SiteNavigationTargetSchema, type SiteNavigationTarget, type SiteSettings } from "@/lib/site-settings";
import { sitePageKindLabel, type SitePageKind } from "@/lib/site-page-kind";

export type SiteNavigationDestinationOption = {
  destination: string;
  label: string;
};

export type SiteNavigationTargetOption = {
  value: string;
  label: string;
  target: SiteNavigationTarget;
};

export type SiteNavigationPageOptionSource = {
  id: string;
  slug: string;
  title: string;
  kind: SitePageKind;
  template: SiteTemplate;
};

export type SiteNavigationPageReference = Pick<SiteNavigationPageOptionSource, "id" | "template"> & Partial<Pick<SiteNavigationPageOptionSource, "kind">>;

export const NO_SITE_DESTINATION = "__no_destination__";
export const CUSTOM_SITE_DESTINATION = "__custom_destination__";
type SiteSectionAnchor = Extract<SiteNavigationTarget, { type: "section" }>["anchor"];
type UnresolvedSiteAnchor = Extract<SiteNavigationTarget, { type: "unresolved" }>["value"];

function navigationPageLabel(page: SiteNavigationPageOptionSource) {
  return page.kind === "legacy" ? page.title : sitePageKindLabel(page.kind, page.template.id);
}

/** Build choices against the pages and actual rendered sections in this project. */
export function siteNavigationTargetOptions(pages: readonly SiteNavigationPageOptionSource[]): SiteNavigationTargetOption[] {
  const options: SiteNavigationTargetOption[] = [{ value: "target:none", label: "No destination", target: { type: "none" } }];
  for (const page of pages) {
    const pageLabel = navigationPageLabel(page);
    options.push({ value: `page:${page.id}`, label: `${pageLabel} page`, target: { type: "page", pageId: page.id } });
    for (const section of siteNavigationDestinationOptions(page.template, page.kind)) {
      options.push({
        value: `section:${page.id}:${section.destination}`,
        label: `${pageLabel} — ${section.label}`,
        target: { type: "section", pageId: page.id, anchor: section.destination as SiteSectionAnchor },
      });
    }
  }
  return options;
}

export function siteNavigationTargetOptionValue(target: SiteNavigationTarget) {
  switch (target.type) {
    case "none": return "target:none";
    case "page": return `page:${target.pageId}`;
    case "section": return `section:${target.pageId}:${target.anchor}`;
    case "external": return "target:external";
    case "unresolved": return `target:unresolved:${target.value}`;
  }
}

export function safeExternalNavigationTarget(value: string): Extract<SiteNavigationTarget, { type: "external" }> | undefined {
  const parsed = SiteNavigationTargetSchema.safeParse({ type: "external", url: value });
  if (!parsed.success || parsed.data.type !== "external") return undefined;
  return { type: "external", url: new URL(parsed.data.url).href };
}

export function siteNavigationEntryWithTarget<T extends SiteSettings["navigation"][number]>(entry: T, target: SiteNavigationTarget): T {
  const validatedTarget = SiteNavigationTargetSchema.parse(target);
  return { ...entry, target: validatedTarget, destination: siteNavigationTargetProjection(validatedTarget) } as T;
}

/** Return a target only when it is valid for the supplied project pages. */
export function resolveSiteNavigationTarget(
  entry: { destination: string; target?: SiteNavigationTarget },
  pages: readonly SiteNavigationPageReference[],
): SiteNavigationTarget | undefined {
  const homePage = pages.find((page) => page.id === "home");
  let target: SiteNavigationTarget;
  if (entry.target) {
    const parsed = SiteNavigationTargetSchema.safeParse(entry.target);
    if (!parsed.success) return undefined;
    target = parsed.data;
  } else {
    if (!homePage || !SiteDestinationSchema.safeParse(entry.destination).success) return undefined;
    target = siteNavigationTargetFromLegacy(entry.destination, homePage);
  }
  if (target.type === "none" || target.type === "external" || target.type === "unresolved") return target;
  const targetPage = pages.find((page) => page.id === target.pageId);
  if (!targetPage) return undefined;
  if (target.type === "section" && !siteNavigationDestinationOptions(targetPage.template, targetPage.kind).some(({ destination }) => destination === target.anchor)) return undefined;
  return target;
}

/** Return only anchors for sections emitted by the shared website renderer. */
export function siteNavigationDestinationOptions(template: SiteTemplate, pageKind: SiteNavigationPageReference["kind"] = "home"): SiteNavigationDestinationOption[] {
  const options: SiteNavigationDestinationOption[] = [
    { destination: "#top", label: "Top of page" },
    { destination: "#site-headline", label: "Hero" },
  ];

  if (pageKind === "about") {
    options.push({ destination: "#site-about", label: "About" });
    if (template.id === "restaurant" && template.content.story?.trim()) options.push({ destination: "#site-story", label: "Our story" });
    if (template.id === "fashion" && template.content.brandStory?.trim()) options.push({ destination: "#site-brand-story", label: "Brand story" });
    if (template.id === "real-estate" && template.content.agencyStory?.trim()) options.push({ destination: "#site-agency-story", label: "Agency story" });
    return options;
  }

  if (pageKind === "contact") {
    options.push({ destination: "#site-contact", label: "Contact" });
    if (template.id === "restaurant" && (template.content.location?.trim() || template.content.openingHours?.trim())) {
      options.push({ destination: "#site-visit", label: "Visit information" });
    }
    return options;
  }

  if (template.id === "restaurant") {
    options.push({ destination: "#site-menu", label: "Menu highlights" });
    // The dedicated Menu page renders the menu section only; optional Home
    // sections are intentionally unavailable there.
    if (pageKind !== "services" && template.content.story?.trim()) options.push({ destination: "#site-story", label: "Our story" });
    if (pageKind !== "services" && (template.content.location?.trim() || template.content.openingHours?.trim())) {
      options.push({ destination: "#site-visit", label: "Visit information" });
    }
  } else if (template.id === "fashion") {
    options.push({ destination: "#site-collections", label: "Collections" });
    if (pageKind !== "products" && template.content.brandStory?.trim()) options.push({ destination: "#site-brand-story", label: "Brand story" });
  } else if (template.id === "real-estate") {
    options.push({ destination: "#site-properties", label: "Properties" });
    if (pageKind !== "services" && template.content.agencyStory?.trim()) options.push({ destination: "#site-agency-story", label: "Agency story" });
  } else if (template.id === "generic") {
    if (pageKind === "services") options.push({ destination: "#site-services", label: "Services" });
    if (pageKind === "products") options.push({ destination: "#site-products", label: "Product highlights" });
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

/** Convert a legacy string destination without ever guessing an absent page. */
export function siteNavigationTargetFromLegacy(destination: string, homePage: { id: string; template: SiteTemplate }): SiteNavigationTarget {
  const normalized = SiteDestinationSchema.parse(destination);
  if (!normalized) return { type: "none" };
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return { type: "external", url: new URL(normalized).href };
  }
  const renderedAnchors = siteNavigationDestinationOptions(homePage.template).map(({ destination: anchor }) => anchor);
  return renderedAnchors.includes(normalized)
    ? { type: "section", pageId: homePage.id, anchor: normalized as SiteSectionAnchor }
    : { type: "unresolved", value: normalized as UnresolvedSiteAnchor };
}

export function siteNavigationTargetProjection(target: SiteNavigationTarget): string {
  switch (target.type) {
    case "none": return "";
    case "external": return target.url;
    case "section": return target.pageId === "home" ? target.anchor : "";
    case "page": return "";
    case "unresolved": return target.value;
  }
}

/** Preserve typed targets across current legacy-editor snapshots when its
 * compatibility string has not changed; otherwise normalize the edited string. */
export function normalizeSiteNavigationTargets(settings: SiteSettings, pages: readonly { id: string; template: SiteTemplate }[]) {
  const homePage = pages.find((page) => page.id === "home");
  if (!homePage) throw new Error("A project must include its Home page.");
  return {
    ...settings,
    navigation: settings.navigation.map((entry) => {
      const target = entry.target && siteNavigationTargetProjection(entry.target) === entry.destination
        ? entry.target
        : siteNavigationTargetFromLegacy(entry.destination, homePage);
      return { ...entry, target };
    }) as SiteSettings["navigation"],
  };
}

/** Validate page references and section anchors against the actual project. */
export function validateSiteNavigationTargets(settings: SiteSettings & { navigation: readonly { target?: SiteNavigationTarget }[] }, pages: readonly { id: string; template: SiteTemplate }[]) {
  return settings.navigation.every((entry) => resolveSiteNavigationTarget(entry, pages) !== undefined);
}
