import { GenerationError } from "@/lib/ai/errors";
import { generateSitePage } from "@/lib/ai/generate-site-page";
import { safeVercelRequestId } from "@/lib/ai/provider-diagnostics";
import { SitePageGenerationRequestSchema, SitePageGenerationResponseSchema } from "@/lib/site-page-generation";

const MAX_BODY_BYTES = 8 * 1024;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const VERCEL_REQUEST_ID_HEADER = "x-generation-vercel-id";

function trustedVercelRequestId(request: Request) {
  // Vercel sets this deployment environment marker; ignore client-provided lookalikes elsewhere.
  if (process.env.VERCEL !== "1") return undefined;
  return safeVercelRequestId(request.headers.get("x-vercel-id"));
}

class RequestBodyError extends Error {
  constructor(public readonly status: 400 | 413, message: string) { super(message); }
}

function errorResponse(status: number, code: string, message: string, vercelRequestId?: string) {
  const headers = new Headers(JSON_HEADERS);
  if (vercelRequestId) headers.set(VERCEL_REQUEST_ID_HEADER, vercelRequestId);
  return Response.json({ error: { code, message } }, { status, headers });
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
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new RequestBodyError(400, "The request body must contain valid JSON."); }
}

export async function POST(request: Request) {
  const vercelRequestId = trustedVercelRequestId(request);
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Send the page request as JSON.", vercelRequestId);
  }

  let body: unknown;
  try { body = await readJsonBody(request); }
  catch (error) {
    if (error instanceof RequestBodyError) return errorResponse(error.status, error.status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON", error.message, vercelRequestId);
    return errorResponse(400, "INVALID_JSON", "The request body could not be read.", vercelRequestId);
  }

  const parsed = SitePageGenerationRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "INVALID_PAGE_REQUEST", "Check the page identity, page type, template, and business brief.", vercelRequestId);

  try {
    const generated = vercelRequestId
      ? await generateSitePage(parsed.data, undefined, { vercelRequestId })
      : await generateSitePage(parsed.data);
    const result = SitePageGenerationResponseSchema.safeParse(generated);
    if (!result.success) return errorResponse(502, "INVALID_GENERATION", "The generation service returned unusable page content. Please try again.", vercelRequestId);
    const headers = new Headers(JSON_HEADERS);
    if (vercelRequestId) headers.set(VERCEL_REQUEST_ID_HEADER, vercelRequestId);
    return Response.json({ data: result.data }, { status: 200, headers });
  } catch (error) {
    if (error instanceof GenerationError) {
      if (error.code === "CONFIGURATION") return errorResponse(503, "GENERATION_NOT_CONFIGURED", "Generation is not configured on this server.", vercelRequestId);
      if (error.code === "REFUSED") return errorResponse(422, "GENERATION_REFUSED", "The request could not be generated. Please revise the business brief and try again.", vercelRequestId);
      if (error.code === "INVALID_REQUEST") return errorResponse(400, "INVALID_PAGE_REQUEST", "Check the page identity, page type, template, and business brief.", vercelRequestId);
      if (error.code === "INCOMPLETE" || error.code === "INVALID_OUTPUT") return errorResponse(502, "INVALID_GENERATION", "The generation service returned unusable page content. Please try again.", vercelRequestId);
    }
    return errorResponse(502, "GENERATION_FAILED", "We couldn’t generate this page right now. Please try again.", vercelRequestId);
  }
}
