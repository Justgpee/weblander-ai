import { GeneratedPageSchema } from "@/lib/generation";
import { GenerationError } from "@/lib/ai/errors";
import { generateFashionLandingPage } from "@/lib/ai/generate-page";
import { FashionSiteTemplateSchema, FashionTemplateGenerationRequestSchema } from "@/lib/site-templates";

const MAX_BODY_BYTES = 8 * 1024;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

class RequestBodyError extends Error {
  constructor(public readonly status: 400 | 413, message: string) { super(message); }
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: JSON_HEADERS });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RequestBodyError(413, "The request is too large.");
  if (!request.body) throw new RequestBodyError(400, "A JSON request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RequestBodyError(413, "The request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new RequestBodyError(400, "The request body must contain valid JSON."); }
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Send the fashion brief as JSON.");
  }

  let body: unknown;
  try { body = await readJsonBody(request); }
  catch (error) {
    if (error instanceof RequestBodyError) return errorResponse(error.status, error.status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON", error.message);
    return errorResponse(400, "INVALID_JSON", "The request body could not be read.");
  }

  const parsed = FashionTemplateGenerationRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "INVALID_TEMPLATE_REQUEST", "Check the fashion template and business brief.");

  try {
    const generated = await generateFashionLandingPage(parsed.data.brief, "editorial");
    const page = GeneratedPageSchema.safeParse(generated.page);
    const template = FashionSiteTemplateSchema.safeParse(generated.template);
    if (!page.success || !template.success) return errorResponse(502, "INVALID_GENERATION", "The generation service returned unusable fashion content. Please try again.");
    return Response.json({ data: { page: page.data, template: template.data } }, { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof GenerationError) {
      if (error.code === "CONFIGURATION") return errorResponse(503, "GENERATION_NOT_CONFIGURED", "Generation is not configured on this server.");
      if (error.code === "REFUSED") return errorResponse(422, "GENERATION_REFUSED", "The request could not be generated. Please revise the business brief and try again.");
      if (error.code === "INCOMPLETE" || error.code === "INVALID_OUTPUT") return errorResponse(502, "INVALID_GENERATION", "The generation service returned unusable fashion content. Please try again.");
    }
    return errorResponse(502, "GENERATION_FAILED", "We couldn’t generate your fashion page right now. Please try again.");
  }
}
