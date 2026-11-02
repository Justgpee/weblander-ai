import { GenerationError } from "@/lib/ai/errors";
import { requestGeneratedSitePage } from "@/lib/ai/openai-provider";
import { ProjectPageV8Schema, ProjectPageContentSchema } from "@/lib/projects";
import {
  SitePageGenerationRequestSchema,
  SitePageGenerationOutputSchema,
  type SitePageGenerationRequest,
} from "@/lib/site-page-generation";

export type SitePageContentProvider = (request: SitePageGenerationRequest) => Promise<unknown>;

export async function generateSitePage(
  input: unknown,
  provider: SitePageContentProvider = requestGeneratedSitePage,
) {
  const request = SitePageGenerationRequestSchema.safeParse(input);
  if (!request.success) throw new GenerationError("INVALID_REQUEST", "Check the page details and selected template.");

  let output: unknown;
  try {
    output = await provider(request.data);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const generated = SitePageGenerationOutputSchema.safeParse(output);
  if (!generated.success) throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable page content. Please try again.");

  const content = ProjectPageContentSchema.safeParse({
    headline: generated.data.headline,
    description: generated.data.description,
    features: generated.data.features,
    callToAction: generated.data.callToAction,
  });
  if (!content.success) throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable page content. Please try again.");

  const page = ProjectPageV8Schema.safeParse({
    ...request.data.identity,
    content: content.data,
    template: request.data.template,
  });
  if (!page.success) throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable page content. Please try again.");
  return page.data;
}
