import { GenerationError } from "@/lib/ai/errors";
import { requestGeneratedSitePage } from "@/lib/ai/openai-provider";
import {
  createProviderCorrelationId,
  logGenerationDiagnostic,
  logProviderFailure,
  safeVercelRequestId,
  type ProviderDiagnosticContext,
} from "@/lib/ai/provider-diagnostics";
import { ProjectPageV8Schema, ProjectPageContentSchema } from "@/lib/projects";
import {
  SitePageGenerationRequestSchema,
  SitePageGenerationOutputSchema,
  type SitePageGenerationRequest,
} from "@/lib/site-page-generation";

export type SitePageContentProvider = (request: SitePageGenerationRequest, diagnosticContext?: ProviderDiagnosticContext) => Promise<unknown>;

export async function generateSitePage(
  input: unknown,
  provider: SitePageContentProvider = requestGeneratedSitePage,
  options?: { vercelRequestId?: string },
) {
  const request = SitePageGenerationRequestSchema.safeParse(input);
  if (!request.success) throw new GenerationError("INVALID_REQUEST", "Check the page details and selected template.");

  const vercelRequestId = safeVercelRequestId(options?.vercelRequestId);
  const diagnosticContext: ProviderDiagnosticContext = {
    correlationId: createProviderCorrelationId(),
    ...(vercelRequestId === undefined ? {} : { vercelRequestId }),
  };
  const startedAt = Date.now();
  let output: unknown;
  try {
    output = await provider(request.data, diagnosticContext);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    logProviderFailure(error, "page-generation", diagnosticContext.correlationId, Date.now() - startedAt, diagnosticContext.vercelRequestId);
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const generated = SitePageGenerationOutputSchema.safeParse(output);
  if (!generated.success) {
    logGenerationDiagnostic({
      operation: "page-generation",
      correlationId: diagnosticContext.correlationId,
      vercelRequestId: diagnosticContext.vercelRequestId,
      failureKind: "schema-validation",
      validationStage: "site-page-output",
      validationIssueCount: generated.error.issues.length,
      durationMs: Date.now() - startedAt,
    });
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable page content. Please try again.");
  }

  const content = ProjectPageContentSchema.safeParse({
    headline: generated.data.headline,
    description: generated.data.description,
    features: generated.data.features,
    callToAction: generated.data.callToAction,
  });
  if (!content.success) {
    logGenerationDiagnostic({
      operation: "page-generation",
      correlationId: diagnosticContext.correlationId,
      vercelRequestId: diagnosticContext.vercelRequestId,
      failureKind: "schema-validation",
      validationStage: "project-page-content",
      validationIssueCount: content.error.issues.length,
      durationMs: Date.now() - startedAt,
    });
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable page content. Please try again.");
  }

  const page = ProjectPageV8Schema.safeParse({
    ...request.data.identity,
    content: content.data,
    template: request.data.template,
  });
  if (!page.success) {
    logGenerationDiagnostic({
      operation: "page-generation",
      correlationId: diagnosticContext.correlationId,
      vercelRequestId: diagnosticContext.vercelRequestId,
      failureKind: "schema-validation",
      validationStage: "project-page-record",
      validationIssueCount: page.error.issues.length,
      durationMs: Date.now() - startedAt,
    });
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable page content. Please try again.");
  }
  return page.data;
}
