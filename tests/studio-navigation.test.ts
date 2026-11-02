import { describe, expect, it } from "vitest";
import { createStudioNavigationCoordinator } from "@/lib/studio-navigation";

describe("studio navigation request identity", () => {
  it("invalidates a pending section scroll when a newer navigation starts", () => {
    const coordinator = createStudioNavigationCoordinator();
    const first = coordinator.begin("project-a", "about", "#site-story");
    const second = coordinator.begin("project-a", "contact", "#site-headline");

    expect(coordinator.isCurrent(first, "project-a", "about")).toBe(false);
    expect(coordinator.isCurrent(second, "project-a", "contact")).toBe(true);
  });

  it("invalidates pending scroll work on page and project transitions", () => {
    const coordinator = createStudioNavigationCoordinator();
    const pending = coordinator.begin("project-a", "about", "#site-story");
    expect(coordinator.isCurrent(pending, "project-a", "about")).toBe(true);

    coordinator.invalidate();
    expect(coordinator.isCurrent(pending, "project-a", "about")).toBe(false);

    const nextProject = coordinator.begin("project-b", "home", "#site-headline");
    expect(coordinator.isCurrent(nextProject, "project-a", "home")).toBe(false);
    expect(coordinator.isCurrent(nextProject, "project-b", "home")).toBe(true);
  });

  it("finishes only the current scroll ticket", () => {
    const coordinator = createStudioNavigationCoordinator();
    const stale = coordinator.begin("project-a", "about", "#site-story");
    const current = coordinator.begin("project-a", "contact", "#site-headline");
    expect(coordinator.finish(stale)).toBe(false);
    expect(coordinator.isCurrent(current, "project-a", "contact")).toBe(true);
    expect(coordinator.finish(current)).toBe(true);
    expect(coordinator.isCurrent(current, "project-a", "contact")).toBe(false);
  });
});
