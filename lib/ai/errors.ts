export type GenerationErrorCode = "CONFIGURATION" | "REFUSED" | "INCOMPLETE" | "PROVIDER" | "INVALID_OUTPUT" | "INVALID_REQUEST";

export class GenerationError extends Error {
  constructor(public readonly code: GenerationErrorCode, message: string) {
    super(message);
    this.name = "GenerationError";
  }
}
