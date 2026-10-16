import { describe, expect, it } from "vitest";
import type { GeneratedPage } from "@/lib/generation";
import { mergeGeneratedSection, mergeGeneratedSectionIfUnchanged } from "@/lib/page-editing";

const page: GeneratedPage = {
  businessName: "Northline", description: "Brand design for climate ventures.", audience: "Early-stage founders",
  offering: "Brand identity", callToAction: "Book a call", style: "Professional", headline: "Make your next chapter unmistakable.",
  subheadline: "Brand identity for early-stage climate ventures ready to grow with purpose.",
  features: ["A thoughtful identity for your next chapter", "Clear direction for meaningful growth"], layout: "editorial",
};

describe("mergeGeneratedSection", () => {
  it("updates only the requested section and preserves unrelated edits", () => {
    const edited = { ...page, callToAction: "Talk with our team", features: ["A distinct voice for your brand", "Design made for ambitious founders"] };
    const result = mergeGeneratedSection(edited, "headline", { headline: "Build a brand with a clearer point of view." });
    expect(result.headline).toBe("Build a brand with a clearer point of view.");
    expect(result.callToAction).toBe("Talk with our team");
    expect(result.features).toEqual(edited.features);
    expect(result.description).toBe(page.description);
  });

  it("rejects invalid regenerated content before merging", () => {
    expect(() => mergeGeneratedSection(page, "headline", { headline: "short" })).toThrow();
  });

  it("keeps a newer same-section edit when an older regeneration response arrives", () => {
    const latest = { ...page, headline: "A newer headline entered while regeneration was running." };
    const result = mergeGeneratedSectionIfUnchanged(
      latest,
      "headline",
      { headline: "An older generated headline for the same section." },
      3,
      4,
    );
    expect(result).toBe(latest);
    expect(result.headline).toBe(latest.headline);
  });

  it("applies the response when the target section was not edited during the request", () => {
    const latest = { ...page, callToAction: "A newer CTA edit in another section" };
    const result = mergeGeneratedSectionIfUnchanged(
      latest,
      "headline",
      { headline: "A regenerated headline that passes validation." },
      3,
      3,
    );
    expect(result.headline).toBe("A regenerated headline that passes validation.");
    expect(result.callToAction).toBe(latest.callToAction);
  });
});
