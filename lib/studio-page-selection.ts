import type { BusinessBrief, GeneratedPage } from "@/lib/generation";
import { ProjectPageContentSchema, ProjectPageSchema, type ProjectPage } from "@/lib/projects";
import type { SiteTemplate } from "@/lib/site-templates";

export type StudioPageSelectionInput = {
  pages: ProjectPage[];
  currentPageId: string;
  targetPageId: string;
  currentPage: GeneratedPage;
  currentTemplate: SiteTemplate;
  currentTemplateValid: boolean;
  targetDraft?: GeneratedPage;
  targetTemplateValid: boolean;
  brief: BusinessBrief;
  layout: GeneratedPage["layout"];
};

export type StudioPageSelection = {
  pages: ProjectPage[];
  page: GeneratedPage;
  template: SiteTemplate;
  templateValid: boolean;
};

/** Resolve a page switch without losing page-local drafts or touching other records. */
export function resolveStudioPageSelection(input: StudioPageSelectionInput): StudioPageSelection | null {
  const current = input.pages.find((record) => record.id === input.currentPageId);
  if (!current) return null;

  const currentContent = ProjectPageContentSchema.safeParse({
    headline: input.currentPage.headline,
    description: input.currentPage.subheadline,
    features: input.currentPage.features,
    callToAction: input.currentPage.callToAction,
  });
  const synchronized = currentContent.success
    ? ProjectPageSchema.safeParse({
      ...current,
      content: currentContent.data,
      template: input.currentTemplateValid ? input.currentTemplate : current.template,
    })
    : null;
  const pages = synchronized?.success
    ? input.pages.map((record) => record.id === current.id ? synchronized.data : record)
    : input.pages;
  const target = pages.find((record) => record.id === input.targetPageId);
  if (!target) return null;

  // Drafts may be temporarily invalid while the user edits. Keep them visible
  // for correction; strict validation still gates persistence and regeneration.
  const content = input.targetDraft ?? {
    headline: target.content.headline,
    subheadline: target.content.description,
    features: target.content.features,
    callToAction: target.content.callToAction,
  };
  const page = {
    ...input.brief,
    headline: content.headline,
    subheadline: content.subheadline,
    features: content.features,
    callToAction: content.callToAction,
    layout: input.layout,
  } as GeneratedPage;

  return { pages, page, template: target.template, templateValid: input.targetTemplateValid };
}
