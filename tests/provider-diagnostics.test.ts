import { afterEach, describe, expect, it, vi } from "vitest";
import { createProviderFailureDiagnostic, logProviderFailure } from "@/lib/ai/provider-diagnostics";

describe("redacted provider diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records only an opaque correlation ID and allowlisted provider metadata", () => {
    const error = Object.assign(new Error("private message with key sk-secret and prompt text"), {
      name: "APIError",
      status: 429,
      code: "rate_limit_exceeded",
      request_id: "req_test_123",
      headers: { authorization: "Bearer secret" },
      response: { body: "private response" },
    });

    const diagnostic = createProviderFailureDiagnostic(error, "page-generation", "correlation-123");

    expect(diagnostic).toEqual({
      correlationId: "correlation-123",
      operation: "page-generation",
      errorClass: "APIError",
      category: "provider-http",
      httpStatus: 429,
      providerCode: "rate_limit_exceeded",
      requestId: "req_test_123",
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(/private message|sk-secret|prompt text|authorization|Bearer|private response/);
  });

  it("omits unrecognized classes, codes, malformed statuses, and unsafe request IDs", () => {
    const error = Object.assign(new Error("do not log"), {
      name: "private-class-name",
      status: 9999,
      code: "sensitive detail",
      request_id: "req id with spaces",
    });
    expect(createProviderFailureDiagnostic(error, "home-generation", "opaque-id")).toEqual({
      correlationId: "opaque-id",
      operation: "home-generation",
      errorClass: "Error",
      category: "unknown",
    });
  });

  it("does not let logging failures interrupt provider error handling", () => {
    vi.spyOn(console, "error").mockImplementation(() => { throw new Error("logger failed"); });
    expect(() => logProviderFailure(new Error("private"), "restaurant-generation")).not.toThrow();
  });
});
