import { SectionContentSchemas, type EditableSection, type GeneratedPage } from "@/lib/generation";

export function mergeGeneratedSection(page: GeneratedPage, section: EditableSection, content: unknown): GeneratedPage {
  const validated = SectionContentSchemas[section].parse(content);
  switch (section) {
    case "headline":
      return { ...page, headline: (validated as { headline: string }).headline };
    case "description":
      return { ...page, subheadline: (validated as { subheadline: string }).subheadline };
    case "features":
      return { ...page, features: (validated as { features: string[] }).features };
    case "callToAction":
      return { ...page, callToAction: (validated as { callToAction: string }).callToAction };
  }
}

export function mergeGeneratedSectionIfUnchanged(
  page: GeneratedPage,
  section: EditableSection,
  content: unknown,
  requestedRevision: number,
  currentRevision: number,
): GeneratedPage {
  if (requestedRevision !== currentRevision) return page;
  return mergeGeneratedSection(page, section, content);
}
