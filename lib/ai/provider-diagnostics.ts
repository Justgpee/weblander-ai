import { randomUUID } from "node:crypto";

export const TEXT_PROVIDER_OPERATIONS = [
  "home-generation",
  "page-generation",
  "section-regeneration",
  "restaurant-generation",
  "fashion-generation",
  "real-estate-generation",
] as const;

export type TextProviderOperation = typeof TEXT_PROVIDER_OPERATIONS[number];
export type GenerationFailureKind =
  | "rate-limit"
  | "provider-server"
  | "provider-http"
  | "timeout"
  | "connection"
  | "incomplete-output"
  | "schema-validation"
  | "unknown";

const SAFE_ERROR_CLASSES = new Set([
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "APIError",
  "AuthenticationError",
  "BadRequestError",
  "ConflictError",
  "InternalServerError",
  "NotFoundError",
  "PermissionDeniedError",
  "RateLimitError",
  "UnprocessableEntityError",
]);

const SAFE_PROVIDER_CODES = new Set([
  "context_length_exceeded",
  "content_policy_violation",
  "insufficient_quota",
  "invalid_api_key",
  "invalid_json",
  "invalid_request_error",
  "invalid_type",
  "invalid_value",
  "model_not_found",
  "rate_limit_exceeded",
  "server_error",
  "temporarily_unavailable",
  "unsupported_parameter",
  "unsupported_value",
]);

const SAFE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
  "ERR_NETWORK",
]);

const SAFE_VALIDATION_STAGES = new Set([
  "provider-response",
  "site-page-output",
  "project-page-content",
  "project-page-record",
]);

export type ProviderFailureDiagnostic = {
  correlationId: string;
  vercelRequestId?: string;
  operation: TextProviderOperation;
  errorClass: string;
  /** Broad compatibility category; `failureKind` provides the finer distinction. */
  category: "connection" | "timeout" | "provider-http" | "unknown";
  failureKind: GenerationFailureKind;
  httpStatus?: number;
  providerCode?: string;
  networkCode?: string;
  requestId?: string;
  durationMs?: number;
  validationStage?: string;
  validationIssueCount?: number;
};

export type ProviderDiagnosticContext = { correlationId?: string; vercelRequestId?: string };

const MAX_VERCEL_REQUEST_ID_LENGTH = 256;
const VERCEL_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*(?:::[A-Za-z0-9][A-Za-z0-9_-]*){1,3}$/;

/** Accepts only the bounded, region-delimited format used by Vercel's x-vercel-id. */
export function safeVercelRequestId(value: unknown): string | undefined {
  return typeof value === "string"
    && value.length <= MAX_VERCEL_REQUEST_ID_LENGTH
    && VERCEL_REQUEST_ID_PATTERN.test(value)
    ? value
    : undefined;
}

function safeProperty(error: unknown, key: string): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    return Reflect.get(error, key) as unknown;
  } catch {
    return undefined;
  }
}

function safeErrorClass(error: unknown) {
  const name = safeProperty(error, "name");
  return typeof name === "string" && SAFE_ERROR_CLASSES.has(name) ? name : error instanceof Error ? "Error" : "NonErrorThrown";
}

function safeHttpStatus(error: unknown) {
  const status = safeProperty(error, "status");
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

function safeProviderCode(error: unknown) {
  const code = safeProperty(error, "code");
  return typeof code === "string" && SAFE_PROVIDER_CODES.has(code) ? code : undefined;
}

function safeNetworkCode(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth += 1) {
    const code = safeProperty(current, "code");
    if (typeof code === "string" && SAFE_NETWORK_CODES.has(code)) return code;
    current = safeProperty(current, "cause");
    if (current === undefined) break;
  }
  return undefined;
}

function safeRequestId(error: unknown) {
  const requestId = safeProperty(error, "request_id");
  return typeof requestId === "string" && /^[A-Za-z0-9_-]{1,96}$/.test(requestId) ? requestId : undefined;
}

function normalizeCorrelationId(correlationId?: string) {
  return typeof correlationId === "string" && /^[A-Za-z0-9_-]{8,96}$/.test(correlationId)
    ? correlationId
    : randomUUID();
}

export function createProviderCorrelationId() {
  return randomUUID();
}

function providerFailureKind(errorClass: string, httpStatus: number | undefined, networkCode: string | undefined): GenerationFailureKind {
  if (errorClass === "APIConnectionTimeoutError" || networkCode === "ETIMEDOUT" || networkCode?.endsWith("_TIMEOUT")) return "timeout";
  if (errorClass === "APIConnectionError" || networkCode !== undefined) return "connection";
  if (httpStatus === 429 || errorClass === "RateLimitError") return "rate-limit";
  if (httpStatus !== undefined && httpStatus >= 500) return "provider-server";
  if (httpStatus !== undefined || errorClass === "APIError" || SAFE_ERROR_CLASSES.has(errorClass)) return "provider-http";
  return "unknown";
}

function providerCategory(failureKind: GenerationFailureKind): ProviderFailureDiagnostic["category"] {
  if (failureKind === "timeout") return "timeout";
  if (failureKind === "connection") return "connection";
  if (failureKind === "rate-limit" || failureKind === "provider-server" || failureKind === "provider-http") return "provider-http";
  return "unknown";
}

export function createProviderFailureDiagnostic(
  error: unknown,
  operation: TextProviderOperation,
  correlationId?: string,
  durationMs?: number,
  vercelRequestId?: string,
): ProviderFailureDiagnostic {
  const errorClass = safeErrorClass(error);
  const httpStatus = safeHttpStatus(error);
  const providerCode = safeProviderCode(error);
  const networkCode = safeNetworkCode(error);
  const requestId = safeRequestId(error);
  const failureKind = providerFailureKind(errorClass, httpStatus, networkCode);
  const safeDuration = typeof durationMs === "number" && Number.isInteger(durationMs) && durationMs >= 0 && durationMs <= 3_600_000
    ? durationMs
    : undefined;
  const safeVercelId = safeVercelRequestId(vercelRequestId);
  return {
    correlationId: normalizeCorrelationId(correlationId),
    ...(safeVercelId === undefined ? {} : { vercelRequestId: safeVercelId }),
    operation,
    errorClass,
    category: providerCategory(failureKind),
    failureKind,
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(networkCode === undefined ? {} : { networkCode }),
    ...(requestId === undefined ? {} : { requestId }),
    ...(safeDuration === undefined ? {} : { durationMs: safeDuration }),
  };
}

/** Logs fixed diagnostic metadata only; exception messages and payloads are never serialized. */
export function logProviderFailure(
  error: unknown,
  operation: TextProviderOperation,
  correlationId?: string,
  durationMs?: number,
  vercelRequestId?: string,
) {
  try {
    console.error("AI provider request failed", createProviderFailureDiagnostic(error, operation, correlationId, durationMs, vercelRequestId));
  } catch {
    // Logging/ID generation is best effort; preserve the caller's safe error path.
  }
}

/** Logs local generation stages without serializing Zod issues or generated content. */
export function logGenerationDiagnostic(input: {
  operation: TextProviderOperation;
  correlationId?: string;
  vercelRequestId?: string;
  failureKind: "incomplete-output" | "schema-validation";
  validationStage: string;
  validationIssueCount?: number;
  durationMs?: number;
}) {
  try {
    const stage = SAFE_VALIDATION_STAGES.has(input.validationStage) ? input.validationStage : "provider-response";
    const issueCount = typeof input.validationIssueCount === "number"
      && Number.isInteger(input.validationIssueCount)
      && input.validationIssueCount >= 0
      && input.validationIssueCount <= 100
      ? input.validationIssueCount
      : undefined;
    const durationMs = typeof input.durationMs === "number"
      && Number.isInteger(input.durationMs)
      && input.durationMs >= 0
      && input.durationMs <= 3_600_000
      ? input.durationMs
      : undefined;
    const vercelRequestId = safeVercelRequestId(input.vercelRequestId);
    console.error("AI generation diagnostic", {
      correlationId: normalizeCorrelationId(input.correlationId),
      ...(vercelRequestId === undefined ? {} : { vercelRequestId }),
      operation: input.operation,
      errorClass: "GenerationValidationError",
      category: "unknown",
      failureKind: input.failureKind,
      validationStage: stage,
      ...(issueCount === undefined ? {} : { validationIssueCount: issueCount }),
      ...(durationMs === undefined ? {} : { durationMs }),
    });
  } catch {
    // Diagnostics must not change generation request handling.
  }
}
