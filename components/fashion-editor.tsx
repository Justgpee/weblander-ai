"use client";

import { useState } from "react";
import { fashionContentToDraft, validateFashionContentDraft, type FashionContentDraft } from "@/lib/fashion-editor-state";
import type { FashionContent } from "@/lib/site-templates";

type FashionEditorProps = {
  content: FashionContent;
  onChange: (content: FashionContent | null) => void;
};

export function FashionEditor({ content, onChange }: FashionEditorProps) {
  const [draft, setDraft] = useState<FashionContentDraft>(() => fashionContentToDraft(content));
  const validation = validateFashionContentDraft(draft);

  function update(next: FashionContentDraft) {
    setDraft(next);
    const result = validateFashionContentDraft(next);
    onChange(result.success ? result.data : null);
  }

  function fieldError(prefix: string) {
    return validation.errors.find((error) => error.startsWith(prefix));
  }

  function updateHighlight(index: number, field: "name" | "description", value: string) {
    update({
      ...draft,
      collectionHighlights: draft.collectionHighlights.map((highlight, itemIndex) => itemIndex === index
        ? { ...highlight, [field]: value }
        : highlight),
    });
  }

  return (
    <details className="copy-editor fashion-editor" open>
      <summary>Edit fashion content <span>Collections and optional story save with this project</span></summary>
      <div className="restaurant-editor-content fashion-editor-content">
        <div className="restaurant-editor-heading">
          <div><strong>Collection highlights</strong><span>Describe collection themes. Product catalog details are not supported here.</span></div>
          <button type="button" onClick={() => update({ ...draft, collectionHighlights: [...draft.collectionHighlights, { name: "", description: "" }] })} disabled={draft.collectionHighlights.length >= 4}>Add collection</button>
        </div>
        <div className="restaurant-editor-menu">
          {draft.collectionHighlights.map((highlight, index) => {
            const nameError = fieldError(`Collection highlight ${index + 1} name`);
            const descriptionError = fieldError(`Collection highlight ${index + 1} description`);
            const nameId = `fashion-collection-name-${index}`;
            const descriptionId = `fashion-collection-description-${index}`;
            return (
              <fieldset className="restaurant-editor-dish" key={index}>
                <legend>Collection highlight {index + 1}</legend>
                <label className="restaurant-editor-field" htmlFor={nameId}>Collection name
                  <input id={nameId} value={highlight.name} onChange={(event) => updateHighlight(index, "name", event.target.value)} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `${nameId}-error` : undefined} />
                  {nameError && <span id={`${nameId}-error`} className="site-settings-error">{nameError}</span>}
                </label>
                <label className="restaurant-editor-field" htmlFor={descriptionId}>Description
                  <textarea id={descriptionId} rows={2} value={highlight.description} onChange={(event) => updateHighlight(index, "description", event.target.value)} aria-invalid={Boolean(descriptionError)} aria-describedby={descriptionError ? `${descriptionId}-error` : undefined} />
                  {descriptionError && <span id={`${descriptionId}-error`} className="site-settings-error">{descriptionError}</span>}
                </label>
                <button className="restaurant-remove-dish" type="button" onClick={() => update({ ...draft, collectionHighlights: draft.collectionHighlights.filter((_, itemIndex) => itemIndex !== index) })} disabled={draft.collectionHighlights.length <= 2}>Remove collection</button>
              </fieldset>
            );
          })}
        </div>
        {validation.errors.some((error) => error === "Keep between two and four collection highlights.") && <p className="restaurant-editor-error" role="alert">Keep between two and four collection highlights. A saved fashion project needs at least two valid collections.</p>}
        <label className="restaurant-editor-field" htmlFor="fashion-brand-story">Brand story <span>Optional; leave blank to omit this section.</span>
          <textarea id="fashion-brand-story" rows={3} value={draft.brandStory} onChange={(event) => update({ ...draft, brandStory: event.target.value })} aria-invalid={Boolean(fieldError("Brand story must"))} aria-describedby={fieldError("Brand story must") ? "fashion-brand-story-error" : undefined} />
          {fieldError("Brand story must") && <span id="fashion-brand-story-error" className="site-settings-error">{fieldError("Brand story must")}</span>}
        </label>
        {validation.errors.length > 0 && <p className="restaurant-editor-error" role="status">Correct the highlighted fashion fields before saving or generating another page.</p>}
      </div>
    </details>
  );
}
