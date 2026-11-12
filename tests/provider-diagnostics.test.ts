import { afterEach, describe, expect, it, vi } from "vitest";
import { createProviderFailureDiagnostic, logGenerationDiagnostic, logProviderFailure } from "@/lib/ai/provider-diagnostics";

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
      failureKind: "rate-limit",
      httpStatus: 429,
      providerCode: "rate_limit_exceeded",
      requestId: "req_test_123",
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(/private message|sk-secret|prompt text|authorization|Bearer|private response/);
  });

  it("includes only bounded, format-validated Vercel IDs in diagnostics", () => {
    const error = Object.assign(new Error("private provider details"), { name: "APIError", status: 503 });
    const diagnostic = createProviderFailureDiagnostic(error, "page-generation", "correlation-123", undefined, "sfo1::iad1::abc123");
    expect(diagnostic).toMatchObject({ correlationId: "correlation-123", vercelRequestId: "sfo1::iad1::abc123" });
    expect(createProviderFailureDiagnostic(error, "page-generation", "correlation-123", undefined, "forged value"))
      .not.toHaveProperty("vercelRequestId");
    expect(createProviderFailureDiagnostic(error, "page-generation", "correlation-123", undefined, `sfo1::${"a".repeat(300)}`))
      .not.toHaveProperty("vercelRequestId");
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
      failureKind: "unknown",
    });
  });

  it.each([500, 502, 503])("classifies HTTP %i as provider-server and retains only its safe status", (status) => {
    const diagnostic = createProviderFailureDiagnostic(Object.assign(new Error("private"), {
      name: "APIError", status, code: "server_error", request_id: "req_server_1",
    }), "page-generation", "page-correlation-1");

    expect(diagnostic).toMatchObject({
      correlationId: "page-correlation-1",
      category: "provider-http",
      failureKind: "provider-server",
      httpStatus: status,
      providerCode: "server_error",
      requestId: "req_server_1",
    });
  });

  it("distinguishes SDK timeouts and network connection failures by allowlisted metadata", () => {
    expect(createProviderFailureDiagnostic(Object.assign(new Error("private"), {
      name: "APIConnectionTimeoutError",
    }), "page-generation", "page-correlation-2")).toMatchObject({
      category: "timeout", failureKind: "timeout", errorClass: "APIConnectionTimeoutError",
    });

    const connectionError = Object.assign(new Error("private"), {
      name: "APIConnectionError",
      cause: Object.assign(new Error("private nested error"), { code: "ECONNRESET" }),
    });
    expect(createProviderFailureDiagnostic(connectionError, "page-generation", "page-correlation-3")).toMatchObject({
      category: "connection", failureKind: "connection", networkCode: "ECONNRESET",
    });
    expect(JSON.stringify(createProviderFailureDiagnostic(connectionError, "page-generation", "page-correlation-3")))
      .not.toMatch(/private|nested error/);
  });

  it("replaces unsafe correlation values and clamps optional timing metadata", () => {
    const diagnostic = createProviderFailureDiagnostic(new Error("private"), "page-generation", "brief contains user data", -1);
    expect(diagnostic.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(diagnostic).not.toHaveProperty("durationMs");
    expect(JSON.stringify(diagnostic)).not.toContain("brief contains user data");
  });

  it("logs only fixed schema-validation metadata and a shared opaque correlation ID", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    logGenerationDiagnostic({
      operation: "page-generation",
      correlationId: "page-correlation-4",
      vercelRequestId: "sfo1::iad1::abc123",
      failureKind: "schema-validation",
      validationStage: "project-page-content",
      validationIssueCount: 3,
      durationMs: 27,
    });
    expect(log).toHaveBeenCalledWith("AI generation diagnostic", {
      correlationId: "page-correlation-4",
      vercelRequestId: "sfo1::iad1::abc123",
      operation: "page-generation",
      errorClass: "GenerationValidationError",
      category: "unknown",
      failureKind: "schema-validation",
      validationStage: "project-page-content",
      validationIssueCount: 3,
      durationMs: 27,
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/prompt text|business brief|secret|authorization|private message/i);
  });

  it("does not let logging failures interrupt provider error handling", () => {
    vi.spyOn(console, "error").mockImplementation(() => { throw new Error("logger failed"); });
    expect(() => logProviderFailure(new Error("private"), "restaurant-generation")).not.toThrow();
  });
});
