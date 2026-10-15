import { GeneratedPageSchema, type BusinessBrief, type GeneratedPage } from "@/lib/generation";
import { GenerationError } from "@/lib/ai/errors";
import { requestGeneratedContent } from "@/lib/ai/openai-provider";

export type ContentProvider = (brief: BusinessBrief) => Promise<unknown>;

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
