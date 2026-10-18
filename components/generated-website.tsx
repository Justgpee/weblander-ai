import type { GeneratedPage } from "@/lib/generation";
import { GENERATED_SITE_CSS, renderGeneratedWebsite } from "@/lib/website-export";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";

/** One content renderer feeds both the interactive preview and the HTML exporter. */
export function GeneratedWebsite({ page, siteSettings = DEFAULT_SITE_SETTINGS }: { page: GeneratedPage; siteSettings?: SiteSettings }) {
  return <><style>{GENERATED_SITE_CSS}</style><div dangerouslySetInnerHTML={{ __html: renderGeneratedWebsite(page, siteSettings) }} /></>;
}
