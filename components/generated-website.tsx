import type { GeneratedPage } from "@/lib/generation";
import { GENERATED_SITE_CSS, renderGeneratedWebsite } from "@/lib/website-export";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";
import type { HeroImageAsset } from "@/lib/site-image";
import { DEFAULT_SITE_TEMPLATE, type SiteTemplate } from "@/lib/site-templates";

/** One content renderer feeds both the interactive preview and the HTML exporter. */
export function GeneratedWebsite({ page, siteSettings = DEFAULT_SITE_SETTINGS, heroImage = null, template = DEFAULT_SITE_TEMPLATE }: { page: GeneratedPage; siteSettings?: SiteSettings; heroImage?: HeroImageAsset | null; template?: SiteTemplate }) {
  return <><style>{GENERATED_SITE_CSS}</style><div dangerouslySetInnerHTML={{ __html: renderGeneratedWebsite(page, siteSettings, heroImage, template) }} /></>;
}
