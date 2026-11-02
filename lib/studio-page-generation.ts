import { ProjectPageSchema, type ProjectPage } from "@/lib/projects";
import { SitePageGenerationRequestSchema, SitePageGenerationResponseSchema } from "@/lib/site-page-generation";
import type { BusinessBrief } from "@/lib/generation";
import type { SiteTemplate } from "@/lib/site-templates";
import { appendProjectPage, pageIdentityForKind, type AddablePageKind, type PageGenerationTicket, createPageGenerationCoordinator } from "@/lib/studio-pages";

export type StudioPageGenerationResult = { status: "added" | "regenerated" | "stale" | "failed"; message?: string };
export type PageGenerationCoordinator = ReturnType<typeof createPageGenerationCoordinator>;

export async function runStudioPageGeneration(options: {
  kind: AddablePageKind;
  brief: BusinessBrief;
  template: SiteTemplate;
  ticket: PageGenerationTicket;
  coordinator: PageGenerationCoordinator;
  getActiveProjectId: () => string | null;
  getPages: () => ProjectPage[];
  setPages: (pages: ProjectPage[]) => void;
  fetcher?: typeof fetch;
}): Promise<StudioPageGenerationResult> {
  const { kind, brief, template, ticket, coordinator, getActiveProjectId, getPages, setPages, fetcher = fetch } = options;
  const isCurrent = () => coordinator.isCurrent(ticket, getActiveProjectId());
  const identity = pageIdentityForKind(kind);
  const request = SitePageGenerationRequestSchema.safeParse({ brief, pageType: kind, identity, template });
  if (!request.success) return { status: "failed", message: "This page type is not available for the current template." };

  try {
    const response = await fetcher("/api/generate-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.data),
    });
    const result: unknown = await response.json();
    if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
      const errorCode = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "code" in result.error && typeof result.error.code === "string"
        ? result.error.code
        : "";
      return {
        status: isCurrent() ? "failed" : "stale",
        message: errorCode === "GENERATION_NOT_CONFIGURED"
          ? "Generation is not configured on this server."
          : errorCode === "INVALID_PAGE_REQUEST"
            ? "This page type is not available for the current template."
            : "We couldn’t generate this page right now. Please try again.",
      };
    }
    const parsedResponse = SitePageGenerationResponseSchema.safeParse(result.data);
    if (!parsedResponse.success
      || parsedResponse.data.id !== identity.id
      || parsedResponse.data.slug !== identity.slug
      || parsedResponse.data.title !== identity.title
      || parsedResponse.data.template.id !== template.id) {
      return { status: isCurrent() ? "failed" : "stale", message: "The generation service returned invalid page content. Please try again." };
    }
    const candidate = ProjectPageSchema.safeParse({ ...parsedResponse.data, kind });
    if (!candidate.success) return { status: isCurrent() ? "failed" : "stale", message: "The generation service returned invalid page content. Please try again." };
    if (!isCurrent()) return { status: "stale" };
    const appended = appendProjectPage(getPages(), candidate.data);
    if (!appended) return { status: "failed", message: "This page already exists or cannot be added to this project." };
    setPages(appended);
    return { status: "added" };
  } catch {
    return isCurrent()
      ? { status: "failed", message: "We couldn’t generate this page right now. Please try again." }
      : { status: "stale" };
  }
}

/** Regenerate one existing page and merge only its content into the latest page array. */
export async function runStudioPageRegeneration(options: {
  target: ProjectPage;
  brief: BusinessBrief;
  ticket: PageGenerationTicket;
  coordinator: PageGenerationCoordinator;
  getActiveProjectId: () => string | null;
  getPages: () => ProjectPage[];
  setPages: (pages: ProjectPage[]) => void;
  fetcher?: typeof fetch;
}): Promise<StudioPageGenerationResult> {
  const { target, brief, ticket, coordinator, getActiveProjectId, getPages, setPages, fetcher = fetch } = options;
  const isCurrent = () => coordinator.isCurrent(ticket, getActiveProjectId());
  if (target.kind === "legacy" || target.kind !== ticket.kind) {
    return { status: "failed", message: "This saved page cannot be regenerated yet." };
  }
  const identity = { id: target.id, slug: target.slug, title: target.title };
  const request = SitePageGenerationRequestSchema.safeParse({ brief, pageType: target.kind, identity, template: target.template });
  if (!request.success) return { status: "failed", message: "This page type is not available for the current template." };

  try {
    const response = await fetcher("/api/generate-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.data),
    });
    const result: unknown = await response.json();
    if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
      const errorCode = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "code" in result.error && typeof result.error.code === "string"
        ? result.error.code : "";
      return {
        status: isCurrent() ? "failed" : "stale",
        message: errorCode === "GENERATION_NOT_CONFIGURED"
          ? "Generation is not configured on this server."
          : "We couldn’t regenerate this page right now. Please try again.",
      };
    }
    const parsed = SitePageGenerationResponseSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.id !== target.id || parsed.data.slug !== target.slug
      || parsed.data.title !== target.title || parsed.data.template.id !== target.template.id) {
      return { status: isCurrent() ? "failed" : "stale", message: "The generation service returned invalid page content. Please try again." };
    }
    const candidate = ProjectPageSchema.safeParse({ ...parsed.data, kind: target.kind });
    if (!candidate.success) return { status: isCurrent() ? "failed" : "stale", message: "The generation service returned invalid page content. Please try again." };
    if (!isCurrent()) return { status: "stale" };

    const pages = getPages();
    const index = pages.findIndex((page) => page.id === target.id);
    const latest = pages[index];
    if (!latest || latest.kind !== target.kind || latest.slug !== target.slug || latest.title !== target.title) {
      return { status: "stale" };
    }
    const merged = ProjectPageSchema.safeParse({
      ...candidate.data,
      id: latest.id,
      slug: latest.slug,
      title: latest.title,
      kind: latest.kind,
    });
    if (!merged.success) return { status: "failed", message: "The generation service returned invalid page content. Please try again." };
    setPages(pages.map((page, pageIndex) => pageIndex === index ? merged.data : page));
    return { status: "regenerated" };
  } catch {
    return isCurrent() ? { status: "failed", message: "We couldn’t regenerate this page right now. Please try again." } : { status: "stale" };
  }
}
