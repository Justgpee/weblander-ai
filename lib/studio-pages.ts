import { ProjectPageSchema, type ProjectPage } from "@/lib/projects";
import { supportedSitePageKinds, sitePageIdentityForKind, sitePageKindLabel, type SitePageKind } from "@/lib/site-page-kind";
import type { SiteTemplateId } from "@/lib/site-templates";

export type AddablePageKind = Exclude<SitePageKind, "legacy">;

export function availablePageKinds(templateId: SiteTemplateId, pages: readonly ProjectPage[]): AddablePageKind[] {
  if (pages.length >= 20) return [];
  const existing = new Set(pages.map((page) => page.kind));
  return supportedSitePageKinds(templateId).filter((kind) => {
    const identity = sitePageIdentityForKind(kind);
    return !existing.has(kind) && !pages.some((page) => page.id === identity.id || page.slug === identity.slug);
  });
}

export function pageKindLabel(kind: AddablePageKind, templateId: SiteTemplateId) {
  return sitePageKindLabel(kind, templateId);
}

export function pageIdentityForKind(kind: AddablePageKind) {
  return sitePageIdentityForKind(kind);
}

/** Validate and append without replacing or reordering any existing page. */
export function appendProjectPage(pages: readonly ProjectPage[], candidate: unknown): ProjectPage[] | null {
  const parsed = ProjectPageSchema.safeParse(candidate);
  if (!parsed.success || pages.length >= 20) return null;
  if (pages.some((page) => page.id === parsed.data.id || page.slug === parsed.data.slug || (page.kind !== "legacy" && page.kind === parsed.data.kind))) return null;
  return [...pages, parsed.data];
}

/** Validate an edit for one page while preserving its stable identity and order. */
export function updateProjectPage(pages: readonly ProjectPage[], pageId: string, update: (page: ProjectPage) => unknown): ProjectPage[] | null {
  const index = pages.findIndex((page) => page.id === pageId);
  if (index < 0) return null;
  const current = pages[index];
  const parsed = ProjectPageSchema.safeParse(update(current));
  if (!parsed.success || parsed.data.id !== current.id || parsed.data.slug !== current.slug
    || parsed.data.title !== current.title || parsed.data.kind !== current.kind) return null;
  return pages.map((page, pageIndex) => pageIndex === index ? parsed.data : page);
}

export type PageGenerationTicket = {
  requestId: number;
  projectId: string | null;
  kind: AddablePageKind;
  revision: number;
  pageRevision: number;
};

/** Tracks one request per project/kind and makes transition-stale requests inert. */
export function createPageGenerationCoordinator() {
  let revision = 0;
  let nextRequestId = 0;
  const inFlight = new Map<string, PageGenerationTicket>();
  const pageRevisions = new Map<string, number>();
  const keyFor = (projectId: string | null, kind: AddablePageKind) => `${projectId ?? "draft"}:${kind}`;

  return {
    begin(projectId: string | null, kind: AddablePageKind): PageGenerationTicket | null {
      const key = keyFor(projectId, kind);
      if (inFlight.has(key)) return null;
      const ticket = { requestId: ++nextRequestId, projectId, kind, revision, pageRevision: pageRevisions.get(key) ?? 0 };
      inFlight.set(key, ticket);
      return ticket;
    },
    isCurrent(ticket: PageGenerationTicket, activeProjectId: string | null) {
      return ticket.revision === revision
        && ticket.projectId === activeProjectId
        && ticket.pageRevision === (pageRevisions.get(keyFor(ticket.projectId, ticket.kind)) ?? 0)
        && inFlight.get(keyFor(ticket.projectId, ticket.kind))?.requestId === ticket.requestId;
    },
    finish(ticket: PageGenerationTicket) {
      const key = keyFor(ticket.projectId, ticket.kind);
      if (inFlight.get(key)?.requestId === ticket.requestId) inFlight.delete(key);
    },
    invalidateForProjectTransition() {
      revision += 1;
      inFlight.clear();
    },
    invalidateForContextChange() {
      revision += 1;
      inFlight.clear();
    },
    invalidatePage(projectId: string | null, kind: AddablePageKind) {
      const key = keyFor(projectId, kind);
      pageRevisions.set(key, (pageRevisions.get(key) ?? 0) + 1);
      inFlight.delete(key);
    },
    isInFlight(projectId: string | null, kind: AddablePageKind) {
      return inFlight.has(keyFor(projectId, kind));
    },
  };
}
