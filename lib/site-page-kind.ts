import { z } from "zod";
import type { SiteTemplateId } from "@/lib/site-templates";

export const SitePageKindSchema = z.enum(["home", "about", "services", "products", "contact", "legacy"]);
export type SitePageKind = z.infer<typeof SitePageKindSchema>;

const PAGE_KINDS_BY_TEMPLATE: Record<SiteTemplateId, readonly SitePageKind[]> = {
  generic: ["home", "about", "services", "products", "contact", "legacy"],
  restaurant: ["home", "about", "services", "contact", "legacy"],
  fashion: ["home", "about", "products", "contact", "legacy"],
  "real-estate": ["home", "about", "services", "contact", "legacy"],
};

const PAGE_TITLES: Record<Exclude<SitePageKind, "legacy">, string> = {
  home: "Home",
  about: "About",
  services: "Services",
  products: "Products",
  contact: "Contact",
};

export function supportedSitePageKinds(templateId: SiteTemplateId): Exclude<SitePageKind, "legacy">[] {
  return PAGE_KINDS_BY_TEMPLATE[templateId].filter((kind): kind is Exclude<SitePageKind, "legacy"> => kind !== "legacy");
}

export function sitePageKindLabel(kind: Exclude<SitePageKind, "legacy">, templateId: SiteTemplateId) {
  if (templateId === "restaurant" && kind === "services") return "Menu";
  if (templateId === "fashion" && kind === "products") return "Collections";
  if (templateId === "real-estate" && kind === "services") return "Properties";
  return PAGE_TITLES[kind];
}

export function sitePageIdentityForKind(kind: Exclude<SitePageKind, "legacy">): PageIdentity {
  return { id: kind, slug: kind === "home" ? "index" : kind, title: PAGE_TITLES[kind] };
}

export function isSitePageKindCompatible(kind: SitePageKind, templateId: SiteTemplateId) {
  return PAGE_KINDS_BY_TEMPLATE[templateId].includes(kind);
}

type PageIdentity = { id: string; slug: string; title: string };

const CANONICAL_IDENTITIES: Record<Exclude<SitePageKind, "legacy">, PageIdentity> = Object.fromEntries(
  (Object.keys(PAGE_TITLES) as Array<Exclude<SitePageKind, "legacy">>).map((kind) => [kind, {
    ...sitePageIdentityForKind(kind),
    title: PAGE_TITLES[kind].toLocaleLowerCase("en-US"),
  }]),
) as Record<Exclude<SitePageKind, "legacy">, PageIdentity>;

/** Infer only canonical identities whose full identity and template semantics agree. */
export function inferSitePageKind(identity: PageIdentity, templateId: SiteTemplateId): SitePageKind {
  const normalizedTitle = identity.title.trim().toLocaleLowerCase("en-US");
  for (const [kind, canonical] of Object.entries(CANONICAL_IDENTITIES) as Array<[Exclude<SitePageKind, "legacy">, PageIdentity]>) {
    if (
      identity.id === canonical.id
      && identity.slug === canonical.slug
      && normalizedTitle === canonical.title
      && isSitePageKindCompatible(kind, templateId)
    ) return kind;
  }
  return "legacy";
}

export function hasCanonicalSitePageIdentity(kind: Exclude<SitePageKind, "legacy">, identity: PageIdentity) {
  const canonical = CANONICAL_IDENTITIES[kind];
  return identity.id === canonical.id && identity.slug === canonical.slug && identity.title.trim().toLocaleLowerCase("en-US") === canonical.title;
}
