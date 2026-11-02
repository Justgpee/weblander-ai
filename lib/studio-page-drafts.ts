export function studioPageDraftKey(projectId: string | null, pageId: string) {
  return `${projectId ?? "draft"}:${pageId}`;
}

/** Keeps page-local UI drafts and validity separate from persisted page records. */
export function createStudioPageDraftStore<T>() {
  const drafts = new Map<string, T>();
  const templateValidity = new Map<string, boolean>();
  return {
    getDraft(key: string) { return drafts.get(key); },
    setDraft(key: string, value: T) { drafts.set(key, value); },
    deleteDraft(key: string) { drafts.delete(key); },
    setTemplateValid(key: string, valid: boolean) { templateValidity.set(key, valid); },
    isTemplateValid(key: string) { return templateValidity.get(key) ?? true; },
    deleteTemplateValidity(key: string) { templateValidity.delete(key); },
    areAllDraftsValid(isValid: (draft: T) => boolean) {
      return [...drafts.values()].every(isValid) && [...templateValidity.values()].every(Boolean);
    },
    clear() {
      drafts.clear();
      templateValidity.clear();
    },
  };
}
