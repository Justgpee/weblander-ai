import { describe, expect, it } from "vitest";
import { EVALUATION_CASES, evaluatePage } from "@/lib/evaluation";

describe("deterministic content evaluation cases", () => {
  it("covers three representative briefs and checks schema, sections, relevance, and CTA", () => {
    const cases = EVALUATION_CASES.slice(0, 3);
    expect(cases).toHaveLength(3);
    for (const evaluationCase of cases) {
      expect(evaluatePage(evaluationCase)).toMatchObject({ schemaValid: true, hasRequiredSections: true, reflectsBrief: true, hasCallToAction: true, claimFlaggedForReview: false });
    }
  });

  it("flags unsupported factual-sounding claims for human review", () => {
    const result = evaluatePage(EVALUATION_CASES[3]);
    expect(result.claimFlaggedForReview).toBe(true);
    expect(result.schemaValid).toBe(true);
  });
});
