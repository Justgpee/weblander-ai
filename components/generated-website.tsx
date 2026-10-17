import type { GeneratedPage } from "@/lib/generation";
import { GENERATED_SITE_CSS, renderGeneratedWebsite } from "@/lib/website-export";

/** One content renderer feeds both the interactive preview and the HTML exporter. */
export function GeneratedWebsite({ page }: { page: GeneratedPage }) {
  return <><style>{GENERATED_SITE_CSS}</style><div dangerouslySetInnerHTML={{ __html: renderGeneratedWebsite(page) }} /></>;
}
