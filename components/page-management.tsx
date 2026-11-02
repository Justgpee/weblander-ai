"use client";

import type { ProjectPage } from "@/lib/projects";
import type { SiteTemplateId } from "@/lib/site-templates";
import { availablePageKinds, pageKindLabel, type AddablePageKind } from "@/lib/studio-pages";
import { sitePageKindLabel } from "@/lib/site-page-kind";
import { useState } from "react";

export type PageGenerationUiState = Record<AddablePageKind, { loading: boolean; error: string }>;
export type PageRegenerationUiState = Record<string, { loading: boolean; error: string }>;

export function PageManagement({
  pages,
  activePageId,
  templateId,
  generationState,
  regenerationState,
  canRegenerate,
  onSelectPage,
  onGeneratePage,
  onRegeneratePage,
}: {
  pages: readonly ProjectPage[];
  activePageId: string;
  templateId: SiteTemplateId;
  generationState: PageGenerationUiState;
  regenerationState: PageRegenerationUiState;
  canRegenerate: boolean;
  onSelectPage: (pageId: string) => void;
  onGeneratePage: (kind: AddablePageKind) => void;
  onRegeneratePage: (pageId: string) => void;
}) {
  const choices = availablePageKinds(templateId, pages);
  const selectedPage = pages.find((page) => page.id === activePageId);
  const regeneration = regenerationState[activePageId] ?? { loading: false, error: "" };
  return <section className="page-management" aria-label="Website pages">
    <div className="page-management-select">
      <label htmlFor="active-site-page">Current page</label>
      <select id="active-site-page" value={activePageId} onChange={(event) => onSelectPage(event.target.value)}>
        {pages.map((page) => <option key={page.id} value={page.id}>{page.kind === "legacy" ? page.title : sitePageKindLabel(page.kind, templateId)}</option>)}
      </select>
    </div>
    {selectedPage && <div className="page-management-regenerate">
      <button type="button" onClick={() => onRegeneratePage(selectedPage.id)} disabled={selectedPage.kind === "legacy" || regeneration.loading || !canRegenerate} aria-busy={regeneration.loading}>
        {regeneration.loading ? "Regenerating page…" : "Regenerate current page"}
      </button>
      {selectedPage.kind === "legacy" && <span className="page-management-help">This older page can be edited, but page regeneration is unavailable.</span>}
      {regeneration.error && <span className="page-management-error" role="alert">{regeneration.error}</span>}
    </div>}
    <GeneratePageControl choices={choices} generationState={generationState} templateId={templateId} onGenerate={onGeneratePage} />
  </section>;
}

function GeneratePageControl({ choices, generationState, templateId, onGenerate }: {
  choices: AddablePageKind[];
  generationState: PageGenerationUiState;
  templateId: SiteTemplateId;
  onGenerate: (kind: AddablePageKind) => void;
}) {
  const [preferredKind, setPreferredKind] = useState<AddablePageKind | null>(null);
  const selectedKind = preferredKind && choices.includes(preferredKind) ? preferredKind : choices[0] ?? null;
  const state = selectedKind ? generationState[selectedKind] : null;
  const isAnyLoading = Object.values(generationState).some((entry) => entry.loading);
  return <div className="page-management-generate">
    <label htmlFor="new-page-kind">Add a page</label>
    {choices.length ? <>
      <select id="new-page-kind" value={selectedKind ?? ""} onChange={(event) => setPreferredKind(event.target.value as AddablePageKind)}>
        {choices.map((kind) => <option key={kind} value={kind}>{pageKindLabel(kind, templateId)}</option>)}
      </select>
      <button type="button" onClick={() => selectedKind && onGenerate(selectedKind)} disabled={!selectedKind || state?.loading} aria-busy={state?.loading ?? false}>
        {state?.loading ? "Generating page…" : "Generate page"}
      </button>
      {state?.error && <span className="page-management-error" role="alert">{state.error}</span>}
      {isAnyLoading && !state?.loading && <span className="page-management-status" role="status">Another page is generating.</span>}
    </> : <span className="page-management-help">No additional supported page types are available.</span>}
  </div>;
}
