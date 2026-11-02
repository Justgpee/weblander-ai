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

export type ProviderFailureDiagnostic = {
  correlationId: string;
  operation: TextProviderOperation;
  errorClass: string;
  category: "connection" | "timeout" | "provider-http" | "unknown";
  httpStatus?: number;
  providerCode?: string;
  requestId?: string;
};

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

function diagnosticCategory(errorClass: string, httpStatus: number | undefined): ProviderFailureDiagnostic["category"] {
  if (errorClass === "APIConnectionTimeoutError") return "timeout";
  if (errorClass === "APIConnectionError") return "connection";
  if (httpStatus !== undefined || errorClass === "APIError" || errorClass.endsWith("Error") && SAFE_ERROR_CLASSES.has(errorClass)) return "provider-http";
  return "unknown";
}

function safeHttpStatus(error: unknown) {
  const status = safeProperty(error, "status");
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

function safeProviderCode(error: unknown) {
  const code = safeProperty(error, "code");
  return typeof code === "string" && SAFE_PROVIDER_CODES.has(code) ? code : undefined;
}

function safeRequestId(error: unknown) {
  const requestId = safeProperty(error, "request_id");
  return typeof requestId === "string" && /^[A-Za-z0-9_-]{1,96}$/.test(requestId) ? requestId : undefined;
}

export function createProviderFailureDiagnostic(
  error: unknown,
  operation: TextProviderOperation,
  correlationId: string = randomUUID(),
): ProviderFailureDiagnostic {
  const errorClass = safeErrorClass(error);
  const httpStatus = safeHttpStatus(error);
  const providerCode = safeProviderCode(error);
  const requestId = safeRequestId(error);
  return {
    correlationId,
    operation,
    errorClass,
    category: diagnosticCategory(errorClass, httpStatus),
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(requestId === undefined ? {} : { requestId }),
  };
}

/** Logs only allowlisted metadata. Diagnostics must never change request handling. */
export function logProviderFailure(error: unknown, operation: TextProviderOperation) {
  try {
    console.error("AI provider request failed", createProviderFailureDiagnostic(error, operation));
  } catch {
    // Logging/ID generation is best effort; preserve the caller's safe error path.
  }
}
