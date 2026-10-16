import type { BusinessBrief, GeneratedPage } from "@/lib/generation";

export function generateSamplePage(brief: BusinessBrief, layout: GeneratedPage["layout"]): GeneratedPage {
  const offer = brief.offering.trim();
  return {
    ...brief,
    businessName: brief.businessName.trim(),
    offering: offer,
    headline: layout === "editorial" ? `${offer}, made for what’s next.` : `Meet your new favorite ${offer.toLowerCase()}.`,
    subheadline: brief.description.trim(),
    features: ["Thoughtfully selected everyday essentials", "Made to bring a little more ease"],
    layout,
  };
}
