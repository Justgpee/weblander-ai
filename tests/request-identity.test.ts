import { describe, expect, it } from "vitest";
import { createEmptySectionRequestState } from "@/lib/section-request-state";
import { createStudioRequestCoordinator } from "@/lib/studio-request-coordinator";
import { heroImageForProject } from "@/lib/project-hero-image";
import type { HeroImageAsset } from "@/lib/site-image";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("studio request coordinator", () => {
  it("does not let an older generation clear a newer request's loading state", async () => {
    const coordinator = createStudioRequestCoordinator();
    const oldResult = deferred<string>();
    const newResult = deferred<string>();
    let loading = false;
    let page = "current page";
    let notice = "";
    const projectId = "project-a";
    const oldIdentity = coordinator.beginGeneration(projectId);
    loading = true;
    const oldRun = coordinator.runGeneration(
      oldIdentity,
      () => coordinator.generationContextKey(projectId),
      () => oldResult.promise,
      (value) => { page = value; },
      () => { notice = "old failure"; },
      () => { loading = false; },
    );

    coordinator.layoutChanged(() => { loading = false; });
    const newIdentity = coordinator.beginGeneration(projectId);
    loading = true;
    const newRun = coordinator.runGeneration(
      newIdentity,
      () => coordinator.generationContextKey(projectId),
      () => newResult.promise,
      (value) => { page = value; },
      () => { notice = "new failure"; },
      () => { loading = false; },
    );

    oldResult.resolve("stale page");
    await oldRun;
    expect(loading).toBe(true);
    expect(page).toBe("current page");
    expect(notice).toBe("");

    newResult.resolve("new page");
    await newRun;
    expect(loading).toBe(false);
    expect(page).toBe("new page");
  });

  it("invalidates generation and section requests on project transition and resets UI state", async () => {
    const coordinator = createStudioRequestCoordinator();
    const generation = deferred<string>();
    const section = deferred<string>();
    let projectId: string | null = "project-a";
    let loading = true;
    let notice = "";
    let content = "project-a headline";
    let sectionState = createEmptySectionRequestState();
    sectionState.headline = { loading: true, error: "previous error" };

    const generationIdentity = coordinator.beginGeneration(projectId);
    const generationRun = coordinator.runGeneration(
      generationIdentity,
      () => coordinator.generationContextKey(projectId),
      () => generation.promise,
      () => { content = "stale page"; },
      () => { notice = "stale generation error"; },
      () => { loading = false; },
    );
    const sectionTicket = coordinator.beginSection("headline", projectId)!;
    const sectionRun = coordinator.runSection(
      sectionTicket,
      () => coordinator.sectionContextKey(projectId),
      () => section.promise,
      (value) => { content = value; },
      () => { sectionState.headline.error = "stale section error"; },
      () => { sectionState.headline.loading = false; },
    );

    coordinator.projectTransition(
      () => { loading = false; },
      () => { sectionState = createEmptySectionRequestState(); },
    );
    projectId = "project-b";
    content = "project-b headline";

    generation.resolve("stale generated page");
    section.resolve("stale generated section");
    await Promise.all([generationRun, sectionRun]);

    expect(content).toBe("project-b headline");
    expect(notice).toBe("");
    expect(loading).toBe(false);
    expect(Object.values(sectionState).every((state) => !state.loading && state.error === "")).toBe(true);
  });

  it("does not apply a late Fashion template result to the project opened afterward", async () => {
    const coordinator = createStudioRequestCoordinator();
    const response = deferred<{ page: string; template: { id: "fashion"; content: { collectionHighlights: Array<{ name: string; description: string }> } } }>();
    let projectId: string | null = "project-a";
    let page = "project-a page";
    let template: { id: "generic" } | { id: "fashion"; content: { collectionHighlights: Array<{ name: string; description: string }> } } = { id: "generic" };
    const identity = coordinator.beginGeneration(projectId);
    const run = coordinator.runGeneration(
      identity,
      () => coordinator.generationContextKey(projectId),
      () => response.promise,
      (generated) => { page = generated.page; template = generated.template; },
      () => undefined,
      () => undefined,
    );

    coordinator.projectTransition();
    projectId = "project-b";
    page = "project-b page";
    template = { id: "generic" };
    response.resolve({
      page: "late Fashion page",
      template: { id: "fashion", content: { collectionHighlights: [
        { name: "Spring layers", description: "Lightweight themes for the season and everyday dressing." },
        { name: "Evening edit", description: "A considered direction for after-dark looks and events." },
      ] } },
    });
    await run;

    expect(page).toBe("project-b page");
    expect(template).toEqual({ id: "generic" });
  });

  it("does not apply a late Real Estate template result to the project opened afterward", async () => {
    const coordinator = createStudioRequestCoordinator();
    const response = deferred<{ page: string; template: { id: "real-estate"; content: { featuredProperties: Array<{ name: string; description: string }> } } }>();
    let projectId: string | null = "project-a";
    let page = "project-a page";
    let template: { id: "generic" } | { id: "real-estate"; content: { featuredProperties: Array<{ name: string; description: string }> } } = { id: "generic" };
    const identity = coordinator.beginGeneration(projectId);
    const run = coordinator.runGeneration(
      identity,
      () => coordinator.generationContextKey(projectId),
      () => response.promise,
      (generated) => { page = generated.page; template = generated.template; },
      () => undefined,
      () => undefined,
    );

    coordinator.projectTransition();
    projectId = "project-b";
    page = "project-b page";
    template = { id: "generic" };
    response.resolve({
      page: "late Real Estate page",
      template: { id: "real-estate", content: { featuredProperties: [
        { name: "Thoughtful city living", description: "A property concept grounded in the agency brief." },
        { name: "Room for a new chapter", description: "A second descriptive highlight for this agency." },
      ] } },
    });
    await run;

    expect(page).toBe("project-b page");
    expect(template).toEqual({ id: "generic" });
  });

  it("ignores a stale generation failure after starting a new draft", async () => {
    const coordinator = createStudioRequestCoordinator();
    const oldResult = deferred<string>();
    const newResult = deferred<string>();
    let projectId: string | null = "project-a";
    let loading = true;
    let notice = "";
    const oldIdentity = coordinator.beginGeneration(projectId);
    const oldRun = coordinator.runGeneration(
      oldIdentity,
      () => coordinator.generationContextKey(projectId),
      () => oldResult.promise,
      () => {},
      () => { notice = "old request failed"; },
      () => { loading = false; },
    );

    coordinator.projectTransition(() => { loading = false; });
    projectId = null;
    const newIdentity = coordinator.beginGeneration(projectId);
    loading = true;
    const newRun = coordinator.runGeneration(
      newIdentity,
      () => coordinator.generationContextKey(projectId),
      () => newResult.promise,
      () => {},
      () => { notice = "new request failed"; },
      () => { loading = false; },
    );

    oldResult.reject(new Error("stale failure"));
    await oldRun;
    expect(loading).toBe(true);
    expect(notice).toBe("");

    newResult.resolve("new draft result");
    await newRun;
    expect(loading).toBe(false);
  });

  it("invalidates generation and section requests when the brief or style changes", async () => {
    const coordinator = createStudioRequestCoordinator();
    const generation = deferred<string>();
    const section = deferred<string>();
    const projectId = "project-a";
    let page = "current page";
    let sectionError = "";
    let loading = true;
    const generationIdentity = coordinator.beginGeneration(projectId);
    const sectionTicket = coordinator.beginSection("features", projectId)!;
    const generationRun = coordinator.runGeneration(
      generationIdentity,
      () => coordinator.generationContextKey(projectId),
      () => generation.promise,
      (value) => { page = value; },
      () => { page = "stale error"; },
      () => { loading = false; },
    );
    const sectionRun = coordinator.runSection(
      sectionTicket,
      () => coordinator.sectionContextKey(projectId),
      () => section.promise,
      (value) => { page = value; },
      () => { sectionError = "stale section failure"; },
      () => {},
    );

    coordinator.briefChanged(() => { loading = false; });
    loading = true;
    generation.resolve("old brief/style result");
    section.reject(new Error("old brief/style failure"));
    await Promise.all([generationRun, sectionRun]);

    expect(page).toBe("current page");
    expect(sectionError).toBe("");
    expect(loading).toBe(true);
  });

  it("keeps a newer section request in flight when an older request completes", async () => {
    const coordinator = createStudioRequestCoordinator();
    const oldResult = deferred<string>();
    const newResult = deferred<string>();
    let projectId: string | null = "project-a";
    let state = createEmptySectionRequestState();
    const oldTicket = coordinator.beginSection("headline", projectId)!;
    state.headline = { loading: true, error: "" };
    const oldRun = coordinator.runSection(
      oldTicket,
      () => coordinator.sectionContextKey(projectId),
      () => oldResult.promise,
      () => { throw new Error("stale success handler ran"); },
      () => { throw new Error("stale failure handler ran"); },
      () => { state.headline.loading = false; },
    );

    coordinator.projectTransition(undefined, () => { state = createEmptySectionRequestState(); });
    projectId = "project-b";
    const newTicket = coordinator.beginSection("headline", projectId)!;
    state.headline = { loading: true, error: "" };
    const newRun = coordinator.runSection(
      newTicket,
      () => coordinator.sectionContextKey(projectId),
      () => newResult.promise,
      () => {},
      () => { state.headline.error = "new request failed"; },
      () => { state.headline.loading = false; },
    );

    oldResult.resolve("old project result");
    await oldRun;
    expect(coordinator.isSectionInFlight("headline")).toBe(true);
    expect(coordinator.beginSection("headline", projectId)).toBeNull();
    expect(state.headline).toEqual({ loading: true, error: "" });

    newResult.resolve("new project result");
    await newRun;
    expect(coordinator.isSectionInFlight("headline")).toBe(false);
    expect(state.headline).toEqual({ loading: false, error: "" });
  });

  it("does not let a stale section failure change the newer request's error or loading state", async () => {
    const coordinator = createStudioRequestCoordinator();
    const oldResult = deferred<string>();
    const newResult = deferred<string>();
    let projectId: string | null = "project-a";
    let state = createEmptySectionRequestState();
    const oldTicket = coordinator.beginSection("features", projectId)!;
    state.features = { loading: true, error: "" };
    const oldRun = coordinator.runSection(
      oldTicket,
      () => coordinator.sectionContextKey(projectId),
      () => oldResult.promise,
      () => {},
      () => { state.features.error = "stale failure"; },
      () => { state.features.loading = false; },
    );

    coordinator.projectTransition(undefined, () => { state = createEmptySectionRequestState(); });
    projectId = "project-b";
    const newTicket = coordinator.beginSection("features", projectId)!;
    state.features = { loading: true, error: "" };
    const newRun = coordinator.runSection(
      newTicket,
      () => coordinator.sectionContextKey(projectId),
      () => newResult.promise,
      () => {},
      () => { state.features.error = "current failure"; },
      () => { state.features.loading = false; },
    );

    oldResult.reject(new Error("late old failure"));
    await oldRun;
    expect(coordinator.isSectionInFlight("features")).toBe(true);
    expect(state.features).toEqual({ loading: true, error: "" });

    newResult.resolve("current result");
    await newRun;
    expect(state.features).toEqual({ loading: false, error: "" });
  });

  it("does not overwrite a newer edit to the regenerated section", async () => {
    const coordinator = createStudioRequestCoordinator();
    const result = deferred<string>();
    const projectId = "project-a";
    let headline = "original headline";
    let loading = true;
    const ticket = coordinator.beginSection("headline", projectId)!;
    const run = coordinator.runSection(
      ticket,
      () => coordinator.sectionContextKey(projectId),
      () => result.promise,
      (value) => { headline = value; },
      () => {},
      () => { loading = false; },
    );

    coordinator.contentEdited("headline");
    headline = "user's newer headline";
    result.resolve("late regenerated headline");
    await run;

    expect(headline).toBe("user's newer headline");
    expect(loading).toBe(false);
  });

  it("allows unrelated sections to regenerate at the same time", () => {
    const coordinator = createStudioRequestCoordinator();
    const headline = coordinator.beginSection("headline", "project-a");
    const features = coordinator.beginSection("features", "project-a");

    expect(headline).not.toBeNull();
    expect(features).not.toBeNull();
    expect(coordinator.beginSection("headline", "project-a")).toBeNull();
  });

  it("blocks duplicate hero-image requests and isolates late completion after a project transition", async () => {
    const coordinator = createStudioRequestCoordinator();
    const oldResult = deferred<string>();
    const newResult = deferred<string>();
    let projectId: string | null = "project-a";
    let image = "project-a image";
    let state = { loading: true, error: "" };
    const oldIdentity = coordinator.beginHeroImage(projectId)!;
    expect(coordinator.beginHeroImage(projectId)).toBeNull();
    const oldRun = coordinator.runHeroImage(
      oldIdentity,
      () => coordinator.heroImageContextKey(projectId),
      () => oldResult.promise,
      (value) => { image = value; },
      () => { state.error = "stale error"; },
      () => { state.loading = false; },
    );

    coordinator.projectTransition(undefined, undefined, () => { state = { loading: false, error: "" }; });
    projectId = "project-b";
    image = "project-b image";
    const newIdentity = coordinator.beginHeroImage(projectId)!;
    state = { loading: true, error: "" };
    const newRun = coordinator.runHeroImage(
      newIdentity,
      () => coordinator.heroImageContextKey(projectId),
      () => newResult.promise,
      (value) => { image = value; },
      () => { state.error = "new error"; },
      () => { state.loading = false; },
    );

    oldResult.resolve("stale project-a image");
    await oldRun;
    expect(image).toBe("project-b image");
    expect(state).toEqual({ loading: true, error: "" });
    expect(coordinator.beginHeroImage(projectId)).toBeNull();

    newResult.resolve("project-b generated image");
    await newRun;
    expect(image).toBe("project-b generated image");
    expect(state).toEqual({ loading: false, error: "" });
  });

  it("ignores hero-image success and failure after a business brief or style change", async () => {
    const coordinator = createStudioRequestCoordinator();
    const successResult = deferred<string>();
    const failureResult = deferred<string>();
    const projectId = "project-a";
    let image = "existing image";
    let state = { loading: false, error: "" };
    const successIdentity = coordinator.beginHeroImage(projectId)!;
    const successRun = coordinator.runHeroImage(
      successIdentity,
      () => coordinator.heroImageContextKey(projectId),
      () => successResult.promise,
      (value) => { image = value; },
      () => { state.error = "stale success request failed"; },
      () => { state.loading = false; },
    );
    coordinator.briefChanged(undefined, undefined, () => { state = { loading: false, error: "" }; });
    const failureIdentity = coordinator.beginHeroImage(projectId)!;
    state = { loading: true, error: "" };
    const failureRun = coordinator.runHeroImage(
      failureIdentity,
      () => coordinator.heroImageContextKey(projectId),
      () => failureResult.promise,
      (value) => { image = value; },
      () => { state.error = "stale failure"; },
      () => { state.loading = false; },
    );
    coordinator.briefChanged(undefined, undefined, () => { state = { loading: false, error: "" }; });

    successResult.resolve("old brief image");
    failureResult.reject(new Error("old style failure"));
    await Promise.all([successRun, failureRun]);
    expect(image).toBe("existing image");
    expect(state).toEqual({ loading: false, error: "" });
  });

  it("does not let a late image response for project A replace project B's fallback or saved image", async () => {
    const coordinator = createStudioRequestCoordinator();
    const response = deferred<HeroImageAsset>();
    let activeProjectId: string | null = "project-a";
    const projectAImage: HeroImageAsset = { mimeType: "image/webp", base64: "UklGRgQAAABXRUJQ" };
    const lateImage: HeroImageAsset = { mimeType: "image/webp", base64: "UklGRgQAAABXUlRQ" };
    let state: { projectId: string | null; image: HeroImageAsset | null } = { projectId: "project-a", image: projectAImage };
    const identity = coordinator.beginHeroImage(activeProjectId)!;
    const run = coordinator.runHeroImage(
      identity,
      () => coordinator.heroImageContextKey(activeProjectId),
      () => response.promise,
      (image) => { state = { projectId: activeProjectId, image }; },
      () => undefined,
      () => undefined,
    );

    coordinator.projectTransition();
    activeProjectId = "project-b";
    state = { projectId: "project-b", image: null };
    expect(heroImageForProject(state, activeProjectId)).toBeNull();

    response.resolve(lateImage);
    await run;
    expect(state).toEqual({ projectId: "project-b", image: null });
    expect(heroImageForProject(state, activeProjectId)).toBeNull();

    const projectBImage: HeroImageAsset = { mimeType: "image/png", base64: "iVBORw0KGgo=" };
    state = { projectId: "project-b", image: projectBImage };
    expect(heroImageForProject(state, activeProjectId)).toBe(projectBImage);
  });

  it("ignores an image completion after removal and allows a newer image to remain", async () => {
    const coordinator = createStudioRequestCoordinator();
    const response = deferred<string>();
    const projectId = "project-a";
    let state = { projectId, image: "original image" as string | null };
    const identity = coordinator.beginHeroImage(projectId)!;
    const run = coordinator.runHeroImage(
      identity,
      () => coordinator.heroImageContextKey(projectId),
      () => response.promise,
      (image) => { state = { projectId, image }; },
      () => undefined,
      () => undefined,
    );

    coordinator.invalidateHeroImage();
    state = { projectId, image: null };
    const newerIdentity = coordinator.beginHeroImage(projectId)!;
    const newer = deferred<string>();
    const newerRun = coordinator.runHeroImage(
      newerIdentity,
      () => coordinator.heroImageContextKey(projectId),
      () => newer.promise,
      (image) => { state = { projectId, image }; },
      () => undefined,
      () => undefined,
    );
    newer.resolve("newer generated image");
    await newerRun;
    expect(state).toEqual({ projectId, image: "newer generated image" });

    response.resolve("stale generated image");
    await run;
    expect(state).toEqual({ projectId, image: "newer generated image" });
  });
});
