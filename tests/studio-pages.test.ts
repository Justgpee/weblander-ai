import { describe, expect, it } from "vitest";
import { ProjectPageSchema, createProjectStorage, projectSnapshotFromPages, type ProjectPage } from "@/lib/projects";
import { availablePageKinds, appendProjectPage, pageIdentityForKind, pageKindLabel, createPageGenerationCoordinator, updateProjectPage } from "@/lib/studio-pages";
import { resolveStudioPageSelection } from "@/lib/studio-page-selection";
import { runStudioPageGeneration, runStudioPageRegeneration } from "@/lib/studio-page-generation";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";
import { DEFAULT_SITE_TEMPLATE } from "@/lib/site-templates";
import { renderGeneratedWebsite } from "@/lib/website-export";

const brief = {
  businessName: "Juniper Kitchen",
  description: "Seasonal neighborhood cooking from locally supplied ingredients.",
  audience: "Local diners",
  offering: "Seasonal plates",
  callToAction: "View the menu",
  style: "Professional" as const,
};

const home: ProjectPage = {
  id: "home", slug: "index", title: "Home", kind: "home",
  content: {
    headline: "A neighborhood table with a seasonal point of view",
    description: "Thoughtful cooking brings local diners together around generous plates and familiar hospitality.",
    features: ["Seasonal ingredients prepared with care", "A welcoming table for local diners"],
    callToAction: "Discover our story",
  },
  template: DEFAULT_SITE_TEMPLATE,
};

const about: ProjectPage = {
  ...home, id: "about", slug: "about", title: "About", kind: "about",
  content: { ...home.content, headline: "A neighborhood kitchen built around good food", callToAction: "Meet our team" },
};

const responseFor = (page: ProjectPage) => ({
  ok: true,
  json: async () => ({ data: {
    id: page.id,
    slug: page.slug,
    title: page.title,
    content: page.content,
    template: page.template,
  } }),
}) as Response;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("studio page choices and append behavior", () => {
  it("uses centralized template compatibility, labels, and duplicate filtering", () => {
    expect(availablePageKinds("generic", [home])).toEqual(["about", "services", "products", "contact"]);
    expect(availablePageKinds("restaurant", [home])).toEqual(["about", "services", "contact"]);
    expect(availablePageKinds("fashion", [home])).toEqual(["about", "products", "contact"]);
    expect(availablePageKinds("real-estate", [home])).toEqual(["about", "services", "contact"]);
    expect(availablePageKinds("restaurant", [home, { ...about, id: "services", slug: "services", title: "Services", kind: "services" }])).toEqual(["about", "contact"]);
    expect(pageKindLabel("services", "restaurant")).toBe("Menu");
    expect(pageKindLabel("products", "fashion")).toBe("Collections");
    expect(pageKindLabel("services", "real-estate")).toBe("Properties");
  });

  it("creates canonical stable identities and appends without changing earlier pages", () => {
    expect(pageIdentityForKind("about")).toEqual({ id: "about", slug: "about", title: "About" });
    const before = [home];
    const appended = appendProjectPage(before, { ...about, kind: "about" });
    expect(appended).toEqual([home, about]);
    expect(before).toEqual([home]);
    expect(appendProjectPage(appended!, { ...about, kind: "about" })).toBeNull();
    expect(ProjectPageSchema.safeParse({ ...about, id: "bad identity", kind: "about" }).success).toBe(false);
  });

  it("edits only the requested page and rejects invalid or identity-changing edits", () => {
    const pages = [home, about];
    const edited = updateProjectPage(pages, "about", (current) => ({
      ...current,
      content: { ...current.content, headline: "An about page with a distinct story for visitors" },
    }));
    expect(edited?.map((page) => page.id)).toEqual(["home", "about"]);
    expect(edited?.[0]).toEqual(home);
    expect(edited?.[1].content.headline).toContain("distinct story");
    expect(updateProjectPage(pages, "about", (current) => ({ ...current, id: "home" }))).toBeNull();
    expect(updateProjectPage(pages, "about", (current) => ({ ...current, content: { ...current.content, headline: "short" } }))).toBeNull();
    expect(pages).toEqual([home, about]);
  });

  it("validates template-specific content before committing a page edit", () => {
    const restaurantTemplate = { id: "restaurant" as const, content: {
      menuHighlights: [
        { name: "Charcoal-grilled plates", description: "Seasoned dishes cooked over charcoal and served fresh." },
        { name: "Homemade rice", description: "Comforting rice prepared daily with familiar local flavors." },
      ],
    } };
    const updated = updateProjectPage([home, about], "about", (current) => ({ ...current, template: restaurantTemplate }));
    expect(updated?.[0]).toEqual(home);
    expect(updated?.[1].template).toEqual(restaurantTemplate);
    expect(updateProjectPage([home, about], "about", (current) => ({
      ...current,
      template: { id: "restaurant", content: { menuHighlights: [{ name: "Only one", description: "This is not enough menu content." }] } },
    }))).toBeNull();
  });

  it("selects each page's own content for the shared website preview without changing other pages", () => {
    const selection = resolveStudioPageSelection({
      pages: [home, about],
      currentPageId: "home",
      targetPageId: "about",
      currentPage: { ...brief, ...home.content, subheadline: home.content.description, layout: "editorial" },
      currentTemplate: home.template,
      currentTemplateValid: true,
      targetTemplateValid: true,
      brief,
      layout: "editorial",
    });

    expect(selection).not.toBeNull();
    expect(selection?.page.headline).toBe(about.content.headline);
    expect(selection?.page.callToAction).toBe(about.content.callToAction);
    expect(selection?.pages[0]).toEqual(home);
    expect(selection?.pages[1]).toEqual(about);
    expect(renderGeneratedWebsite(selection!.page, DEFAULT_SITE_SETTINGS, null, selection!.template, {
      currentPageId: "about",
      pages: selection!.pages,
    })).toContain(`<h1 id="site-headline">${about.content.headline}</h1>`);
  });

  it("restores temporarily invalid page drafts when switching back without throwing", () => {
    const invalidHomeDraft = {
      ...brief,
      headline: "Short",
      subheadline: home.content.description,
      features: home.content.features,
      callToAction: home.content.callToAction,
      layout: "editorial" as const,
    };
    const away = resolveStudioPageSelection({
      pages: [home, about], currentPageId: "home", targetPageId: "about", currentPage: invalidHomeDraft,
      currentTemplate: home.template, currentTemplateValid: true, targetTemplateValid: true, brief, layout: "editorial",
    });
    expect(away?.page.headline).toBe(about.content.headline);

    const back = resolveStudioPageSelection({
      pages: away!.pages, currentPageId: "about", targetPageId: "home",
      currentPage: { ...brief, headline: about.content.headline, subheadline: about.content.description, features: about.content.features, callToAction: about.content.callToAction, layout: "editorial" },
      currentTemplate: about.template, currentTemplateValid: true, targetDraft: invalidHomeDraft,
      targetTemplateValid: true, brief, layout: "editorial",
    });
    expect(back?.page.headline).toBe("Short");
  });
});

describe("page generation request lifecycle", () => {
  it("rejects duplicate concurrent requests for the same project and kind", () => {
    const coordinator = createPageGenerationCoordinator();
    expect(coordinator.begin("project-a", "about")).not.toBeNull();
    expect(coordinator.begin("project-a", "about")).toBeNull();
    expect(coordinator.begin("project-a", "contact")).not.toBeNull();
  });

  it("does not let a stale completion clear a newer request entry", () => {
    const coordinator = createPageGenerationCoordinator();
    const stale = coordinator.begin("project-a", "about")!;
    coordinator.invalidateForProjectTransition();
    const current = coordinator.begin("project-a", "about")!;
    coordinator.finish(stale);
    expect(coordinator.isCurrent(current, "project-a")).toBe(true);
    expect(coordinator.begin("project-a", "about")).toBeNull();
  });

  it("invalidates regeneration for one edited page without invalidating another page request", () => {
    const coordinator = createPageGenerationCoordinator();
    const aboutTicket = coordinator.begin("project-a", "about")!;
    const contactTicket = coordinator.begin("project-a", "contact")!;
    coordinator.invalidatePage("project-a", "about");
    expect(coordinator.isCurrent(aboutTicket, "project-a")).toBe(false);
    expect(coordinator.isCurrent(contactTicket, "project-a")).toBe(true);
    coordinator.finish(aboutTicket);
    expect(coordinator.isCurrent(contactTicket, "project-a")).toBe(true);
  });

  it("discards a delayed response after switching projects", async () => {
    const coordinator = createPageGenerationCoordinator();
    const ticket = coordinator.begin("project-a", "about")!;
    const response = deferred<Response>();
    let activeProjectId: string | null = "project-a";
    let pages: ProjectPage[] = [home];
    const task = runStudioPageGeneration({
      kind: "about", brief, template: DEFAULT_SITE_TEMPLATE, ticket, coordinator,
      getActiveProjectId: () => activeProjectId, getPages: () => pages, setPages: (next) => { pages = next; },
      fetcher: () => response.promise,
    });
    activeProjectId = "project-b";
    pages = [{ ...home, content: { ...home.content, headline: "Another business homepage that remains unchanged" } }];
    coordinator.invalidateForProjectTransition();
    response.resolve(responseFor(about));
    await expect(task).resolves.toEqual({ status: "stale" });
    expect(pages).toHaveLength(1);
    expect(pages[0].content.headline).toContain("Another business");
  });

  it("appends while another page is selected without changing that selection", async () => {
    const coordinator = createPageGenerationCoordinator();
    const ticket = coordinator.begin("project-a", "about")!;
    let selectedPageId = "home";
    let pages = [home];
    const task = runStudioPageGeneration({
      kind: "about", brief, template: DEFAULT_SITE_TEMPLATE, ticket, coordinator,
      getActiveProjectId: () => "project-a", getPages: () => pages, setPages: (next) => { pages = next; },
      fetcher: async () => responseFor(about),
    });
    selectedPageId = "contact";
    await expect(task).resolves.toEqual({ status: "added" });
    expect(pages.map((page) => page.id)).toEqual(["home", "about"]);
    expect(pages[0]).toEqual(home);
    expect(selectedPageId).toBe("contact");
  });

  it("merges concurrent different-kind results into the latest ordered page array", async () => {
    const coordinator = createPageGenerationCoordinator();
    let pages = [home];
    const aboutResponse = deferred<Response>();
    const contactPage: ProjectPage = {
      ...about,
      id: "contact",
      slug: "contact",
      title: "Contact",
      kind: "contact",
      content: { ...about.content, headline: "Talk with our neighborhood kitchen team" },
    };
    const aboutTicket = coordinator.begin("project-a", "about")!;
    const contactTicket = coordinator.begin("project-a", "contact")!;
    const aboutTask = runStudioPageGeneration({
      kind: "about", brief, template: DEFAULT_SITE_TEMPLATE, ticket: aboutTicket, coordinator,
      getActiveProjectId: () => "project-a", getPages: () => pages, setPages: (next) => { pages = next; },
      fetcher: () => aboutResponse.promise,
    });
    const contactTask = runStudioPageGeneration({
      kind: "contact", brief, template: DEFAULT_SITE_TEMPLATE, ticket: contactTicket, coordinator,
      getActiveProjectId: () => "project-a", getPages: () => pages, setPages: (next) => { pages = next; },
      fetcher: async () => responseFor(contactPage),
    });
    await expect(contactTask).resolves.toEqual({ status: "added" });
    aboutResponse.resolve(responseFor(about));
    await expect(aboutTask).resolves.toEqual({ status: "added" });
    expect(pages.map((page) => page.id)).toEqual(["home", "contact", "about"]);
    expect(pages[0]).toEqual(home);
  });

  it("reports API failures and malformed or mismatched responses without appending", async () => {
    const run = async (fetcher: typeof fetch) => {
      const coordinator = createPageGenerationCoordinator();
      const ticket = coordinator.begin("project-a", "about")!;
      let pages = [home];
      const result = await runStudioPageGeneration({
        kind: "about", brief, template: DEFAULT_SITE_TEMPLATE, ticket, coordinator,
        getActiveProjectId: () => "project-a", getPages: () => pages, setPages: (next) => { pages = next; }, fetcher,
      });
      expect(pages).toEqual([home]);
      return result;
    };
    await expect(run(async () => ({ ok: false, json: async () => ({ error: { code: "GENERATION_FAILED" } }) }) as Response))
      .resolves.toEqual({ status: "failed", message: "We couldn’t generate this page right now. Please try again." });
    await expect(run(async () => ({ ok: true, json: async () => ({ data: { nonsense: true } }) }) as Response))
      .resolves.toEqual({ status: "failed", message: "The generation service returned invalid page content. Please try again." });
    await expect(run(async () => responseFor({ ...about, id: "contact", slug: "contact", title: "Contact", kind: "contact" })))
      .resolves.toMatchObject({ status: "failed" });
  });
});

describe("page-specific regeneration", () => {
  it("replaces only the target page content and preserves identity, kind, order, and newer unrelated edits", async () => {
    const coordinator = createPageGenerationCoordinator();
    const ticket = coordinator.begin("project-a", "about")!;
    const response = deferred<Response>();
    const changedContact = { ...about, id: "contact", slug: "contact", title: "Contact", kind: "contact" as const,
      content: { ...about.content, headline: "Contact details edited while the other page regenerated" } };
    let pages: ProjectPage[] = [home, about, changedContact];
    const task = runStudioPageRegeneration({
      target: about, brief, ticket, coordinator,
      getActiveProjectId: () => "project-a", getPages: () => pages, setPages: (next) => { pages = next; },
      fetcher: () => response.promise,
    });
    response.resolve(responseFor({ ...about, content: { ...about.content, headline: "A newly regenerated about page for visitors" } }));
    await expect(task).resolves.toEqual({ status: "regenerated" });
    expect(pages.map((page) => page.id)).toEqual(["home", "about", "contact"]);
    expect(pages[0]).toEqual(home);
    expect(pages[1]).toMatchObject({ id: "about", slug: "about", title: "About", kind: "about" });
    expect(pages[1].content.headline).toContain("newly regenerated");
    expect(pages[2]).toEqual(changedContact);
  });

  it("ignores a delayed result after project switch or an edit to the target page", async () => {
    for (const invalidate of ["transition", "page-edit"] as const) {
      const coordinator = createPageGenerationCoordinator();
      const ticket = coordinator.begin("project-a", "about")!;
      const response = deferred<Response>();
      let activeProjectId: string | null = "project-a";
      let pages: ProjectPage[] = [home, about];
      const task = runStudioPageRegeneration({
        target: about, brief, ticket, coordinator,
        getActiveProjectId: () => activeProjectId, getPages: () => pages, setPages: (next) => { pages = next; },
        fetcher: () => response.promise,
      });
      if (invalidate === "transition") {
        activeProjectId = "project-b";
        coordinator.invalidateForProjectTransition();
      } else {
        pages = [home, { ...about, content: { ...about.content, headline: "The latest user edit stays on this page" } }];
        coordinator.invalidatePage("project-a", "about");
      }
      const before = pages;
      response.resolve(responseFor({ ...about, content: { ...about.content, headline: "Stale generated page content should not apply" } }));
      await expect(task).resolves.toEqual({ status: "stale" });
      expect(pages).toEqual(before);
    }
  });

  it("rejects malformed regenerated content without changing the page array", async () => {
    const coordinator = createPageGenerationCoordinator();
    const ticket = coordinator.begin("project-a", "about")!;
    let pages: ProjectPage[] = [home, about];
    const result = await runStudioPageRegeneration({
      target: about, brief, ticket, coordinator,
      getActiveProjectId: () => "project-a", getPages: () => pages, setPages: (next) => { pages = next; },
      fetcher: async () => ({ ok: true, json: async () => ({ data: { id: "about", content: {} } }) }) as Response,
    });
    expect(result.status).toBe("failed");
    expect(pages).toEqual([home, about]);
  });
});

describe("complete page snapshots", () => {
  it("saves, reloads, and retains the ordered full page collection", () => {
    let stored = "";
    const storage = createProjectStorage({
      storage: { getItem: () => stored || null, setItem: (_key, value) => { stored = value; } },
      now: () => new Date("2026-10-24T12:00:00.000Z"),
      createId: () => "cd1a2396-7647-4acd-a11c-d0977f0b72bb",
    });
    const snapshot = projectSnapshotFromPages(brief, [home, about], "editorial", DEFAULT_SITE_SETTINGS);
    const created = storage.create("Juniper Kitchen", snapshot);
    const reopened = storage.load(created.id);
    expect(reopened.pages).toEqual([home, about]);
    const editedHome = { ...home, content: { ...home.content, headline: "A saved homepage with careful seasonal cooking" } };
    const editedAbout = { ...about, content: { ...about.content, headline: "An about page saved with its own careful story" } };
    const saved = storage.save(created.id, projectSnapshotFromPages(brief, [editedHome, editedAbout], "editorial", DEFAULT_SITE_SETTINGS), reopened.revision);
    expect(storage.load(saved.id).pages.map((page) => page.id)).toEqual(["home", "about"]);
    expect(storage.load(saved.id).pages[1].content.headline).toBe(editedAbout.content.headline);
    expect(storage.load(saved.id).pages[0].content.headline).toBe(editedHome.content.headline);
  });
});
