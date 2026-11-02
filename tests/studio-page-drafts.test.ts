import { describe, expect, it } from "vitest";
import { createStudioPageDraftStore, studioPageDraftKey } from "@/lib/studio-page-drafts";

describe("studio page draft isolation", () => {
  it("retains an invalid page draft across selection changes without marking another page invalid", () => {
    const drafts = createStudioPageDraftStore<{ headline: string }>();
    const homeKey = studioPageDraftKey("project-a", "home");
    const aboutKey = studioPageDraftKey("project-a", "about");
    drafts.setDraft(homeKey, { headline: "unfinished" });
    drafts.setDraft(aboutKey, { headline: "A valid about page title" });
    drafts.setTemplateValid(homeKey, false);

    expect(drafts.getDraft(homeKey)).toEqual({ headline: "unfinished" });
    expect(drafts.getDraft(aboutKey)).toEqual({ headline: "A valid about page title" });
    expect(drafts.areAllDraftsValid((draft) => draft.headline.length >= 8)).toBe(false);

    drafts.setDraft(homeKey, { headline: "A corrected home page title" });
    drafts.setTemplateValid(homeKey, true);
    expect(drafts.areAllDraftsValid((draft) => draft.headline.length >= 8)).toBe(true);
  });

  it("uses project-scoped keys and clears drafts on a project transition", () => {
    const drafts = createStudioPageDraftStore<string>();
    const projectA = studioPageDraftKey("project-a", "about");
    const projectB = studioPageDraftKey("project-b", "about");
    drafts.setDraft(projectA, "Project A draft");
    drafts.setDraft(projectB, "Project B content");
    expect(drafts.getDraft(projectA)).not.toBe(drafts.getDraft(projectB));
    drafts.clear();
    expect(drafts.getDraft(projectA)).toBeUndefined();
    expect(drafts.getDraft(projectB)).toBeUndefined();
  });
});
