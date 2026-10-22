import { GenerationError } from "@/lib/ai/errors";
import { generateHeroImage } from "@/lib/ai/generate-image";
import { GenerateHeroImageRequestSchema } from "@/lib/site-image";

export const maxDuration = 60;

const MAX_BODY_BYTES = 8 * 1024;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

class RequestBodyError extends Error {
  constructor(public readonly status: 400 | 413, message: string) { super(message); }
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

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: JSON_HEADERS });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Send the image request as JSON.");
  }
  let body: unknown;
  try { body = await readJsonBody(request); }
  catch (error) {
    if (error instanceof RequestBodyError) return errorResponse(error.status, error.status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON", error.message);
    return errorResponse(400, "INVALID_JSON", "The request body could not be read.");
  }
  const parsed = GenerateHeroImageRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "INVALID_IMAGE_REQUEST", "Check the business brief and try again.");

  try {
    const image = await generateHeroImage(parsed.data);
    return Response.json({ data: image }, { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof GenerationError && error.code === "CONFIGURATION") {
      return errorResponse(503, "IMAGE_GENERATION_NOT_CONFIGURED", "Image generation is not configured on this server.");
    }
    if (error instanceof GenerationError && (error.code === "INCOMPLETE" || error.code === "INVALID_OUTPUT")) {
      return errorResponse(502, "INVALID_IMAGE_GENERATION", "The image service returned unusable content. Please try again.");
    }
    return errorResponse(502, "IMAGE_GENERATION_FAILED", "We couldn’t generate an image right now. Please try again.");
  }
}
