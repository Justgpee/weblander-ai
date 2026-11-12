import { GenerationError } from "@/lib/ai/errors";
import { createProviderCorrelationId, safeVercelRequestId, type ProviderDiagnosticContext } from "@/lib/ai/provider-diagnostics";
import { regeneratePageSection } from "@/lib/ai/generate-page";
import { requestGeneratedPageSection } from "@/lib/ai/openai-provider";
import {
  PageSectionContentSchemas,
  PageSectionGenerationRequestSchema,
  type PageRegenerationSection,
  type PageSectionGenerationRequest,
} from "@/lib/page-section-generation";
import type { EditableSection } from "@/lib/generation";

export type PageSectionProvider = (request: PageSectionGenerationRequest, section: PageRegenerationSection, diagnosticContext?: ProviderDiagnosticContext) => Promise<unknown>;
export type CorePageSectionProvider = (brief: PageSectionGenerationRequest["brief"], section: EditableSection, diagnosticContext?: ProviderDiagnosticContext) => Promise<unknown>;

export async function regenerateSitePageSection(
  input: unknown,
  provider: PageSectionProvider = requestGeneratedPageSection,
  coreProvider: CorePageSectionProvider = (brief, section, context) => regeneratePageSection(brief, section, undefined, context),
  options?: { vercelRequestId?: string },
) {
  const parsed = PageSectionGenerationRequestSchema.safeParse(input);
  if (!parsed.success) throw new GenerationError("INVALID_REQUEST", "Check the page identity, template, and section to regenerate.");
  const section = parsed.data.section;
  const suppliedVercelId = safeVercelRequestId(options?.vercelRequestId);
  const diagnosticContext: ProviderDiagnosticContext = {
    correlationId: createProviderCorrelationId(),
    ...(suppliedVercelId === undefined ? {} : { vercelRequestId: suppliedVercelId }),
  };
  let generated: unknown;
  if (["headline", "description", "features", "callToAction"].includes(section)) {
    generated = await coreProvider(
      parsed.data.brief,
      section as EditableSection,
      diagnosticContext,
    );
  } else {
    try {
      generated = await provider(parsed.data, section, diagnosticContext);
    } catch (error) {
      if (error instanceof GenerationError) throw error;
      throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
    }
  }
  const validated = PageSectionContentSchemas[section].safeParse(generated);
  if (!validated.success) throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable content. Please try again.");
  return validated.data;
}
