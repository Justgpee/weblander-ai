import { GeneratedPageSchema, SectionContentSchemas, type BusinessBrief, type EditableSection, type GeneratedPage } from "@/lib/generation";
import { GenerationError } from "@/lib/ai/errors";
import { requestGeneratedContent, requestGeneratedSection } from "@/lib/ai/openai-provider";

export type ContentProvider = (brief: BusinessBrief) => Promise<unknown>;
export type SectionContentProvider = (brief: BusinessBrief, section: EditableSection) => Promise<unknown>;

export async function generateLandingPage(
  brief: BusinessBrief,
  layout: GeneratedPage["layout"],
  provider: ContentProvider = requestGeneratedContent,
): Promise<GeneratedPage> {
  let content: unknown;
  try {
    content = await provider(brief);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const result = GeneratedPageSchema.safeParse({ ...brief, ...content as object, layout });
  if (!result.success) throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable content. Please try again.");
  return result.data;
}

export async function regeneratePageSection(
  brief: BusinessBrief,
  section: EditableSection,
  provider: SectionContentProvider = requestGeneratedSection,
) {
  let content: unknown;
  try {
    content = await provider(brief, section);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const result = SectionContentSchemas[section].safeParse(content);
  if (!result.success) throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable content. Please try again.");
  return result.data;
}
