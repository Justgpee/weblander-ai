import { describe, expect, it } from "vitest";
import { heroImageForProject } from "@/lib/project-hero-image";
import { projectSnapshotFromPage } from "@/lib/projects";
import type { BusinessBrief } from "@/lib/generation";

const imageA = { mimeType: "image/webp" as const, base64: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString("base64") };
const imageB = { mimeType: "image/png" as const, base64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64") };
const brief: BusinessBrief = {
  businessName: "Northline",
  description: "Brand design for climate ventures.",
  audience: "Early-stage founders",
  offering: "Brand identity",
  callToAction: "Book a call",
  style: "Professional",
};
const page = {
  headline: "Make your next chapter unmistakable.",
  subheadline: "Brand identity for early-stage climate ventures ready to grow with purpose.",
  features: ["A thoughtful identity for your next chapter", "Clear direction for meaningful growth"],
  callToAction: "Talk with our team",
};

describe("project-scoped hero images", () => {
  it("clears project A's image for project B and resolves each saved image only for its owner", () => {
    const projectA = { projectId: "project-a", image: imageA };
    const projectB = { projectId: "project-b", image: null };
    expect(heroImageForProject(projectA, "project-a")).toEqual(imageA);
    expect(heroImageForProject(projectA, "project-b")).toBeNull();
    expect(heroImageForProject(projectB, "project-b")).toBeNull();

    const projectBWithImage = { projectId: "project-b", image: imageB };
    expect(heroImageForProject(projectBWithImage, "project-b")).toEqual(imageB);
    expect(heroImageForProject(projectBWithImage, "project-a")).toBeNull();
    expect(heroImageForProject(projectA, "project-a")).toEqual(imageA);
  });

  it("does not copy project A's image into project B's autosave snapshot", () => {
    const projectAImage = { projectId: "project-a", image: imageA };
    const snapshot = projectSnapshotFromPage(
      brief,
      page,
      "editorial",
      undefined,
      heroImageForProject(projectAImage, "project-b"),
    );
    expect(snapshot.heroImage).toBeNull();
  });
});
