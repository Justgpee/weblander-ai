import type { MouseEvent } from "react";
import type { GeneratedPage } from "@/lib/generation";
import { GENERATED_SITE_CSS, renderGeneratedWebsite } from "@/lib/website-export";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";
import type { HeroImageAsset } from "@/lib/site-image";
import type { SiteLogoAsset } from "@/lib/site-logo";
import { DEFAULT_SITE_TEMPLATE, type SiteTemplate } from "@/lib/site-templates";
import type { SiteNavigationPageReference } from "@/lib/site-navigation-options";
import type { SitePageKind } from "@/lib/site-page-kind";

/** One content renderer feeds both the interactive preview and the HTML exporter. */
export function GeneratedWebsite({ page, siteSettings = DEFAULT_SITE_SETTINGS, heroImage = null, logoAsset = null, template = DEFAULT_SITE_TEMPLATE, pageKind = "home", currentPageId = "home", pages, onNavigate }: {
  page: GeneratedPage;
  siteSettings?: SiteSettings;
  heroImage?: HeroImageAsset | null;
  logoAsset?: SiteLogoAsset | null;
  template?: SiteTemplate;
  pageKind?: SitePageKind;
  currentPageId?: string;
  pages?: readonly SiteNavigationPageReference[];
  onNavigate?: (pageId: string, anchor?: string) => void;
}) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const clicked = event.target as Element;
    const logo = clicked.closest<HTMLAnchorElement>('.site-logo[href="#top"]');
    if (logo) {
      event.preventDefault();
      onNavigate?.("home", "#top");
      return;
    }
    const sectionLink = clicked.closest<HTMLAnchorElement>(".site-nav-links a[href^='#']");
    if (sectionLink) {
      const anchor = sectionLink.getAttribute("href");
      if (anchor) {
        event.preventDefault();
        onNavigate?.(currentPageId, anchor);
      }
      return;
    }
    const target = clicked.closest<HTMLElement>("[data-site-navigation-action]");
    if (!target) return;
    const action = target.dataset.siteNavigationAction;
    if (action === "page" || action === "page-section") {
      event.preventDefault();
      const pageId = target.dataset.pageId;
      if (pageId) onNavigate?.(pageId, action === "page-section" ? target.dataset.siteNavigationAnchor : undefined);
    }
  };

  return <><style>{GENERATED_SITE_CSS}</style><div
    className="generated-website-preview"
    data-site-preview-page={currentPageId}
    onClick={onNavigate ? handleClick : undefined}
    dangerouslySetInnerHTML={{ __html: renderGeneratedWebsite(page, siteSettings, heroImage, template, { currentPageId, pageKind, pages: pages ?? [{ id: currentPageId, template, kind: pageKind }] }, logoAsset) }}
  /></>;
}
