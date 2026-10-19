import { describe, expect, it } from "vitest";
import { createEmptySectionRequestState } from "@/lib/section-request-state";
import { createStudioRequestCoordinator } from "@/lib/studio-request-coordinator";

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
});
