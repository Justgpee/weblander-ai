"use client";

import { useState } from "react";
import { restaurantContentToDraft, validateRestaurantContentDraft, type RestaurantContentDraft } from "@/lib/restaurant-editor-state";
import type { RestaurantContent } from "@/lib/site-templates";

type RestaurantEditorProps = {
  content: RestaurantContent;
  onChange: (content: RestaurantContent | null) => void;
};

export function RestaurantEditor({ content, onChange }: RestaurantEditorProps) {
  const [draft, setDraft] = useState<RestaurantContentDraft>(() => restaurantContentToDraft(content));
  const validation = validateRestaurantContentDraft(draft);

  function update(next: RestaurantContentDraft) {
    setDraft(next);
    const result = validateRestaurantContentDraft(next);
    onChange(result.success ? result.data : null);
  }

  function fieldError(prefix: string) {
    return validation.errors.find((error) => error.startsWith(prefix));
  }

  function updateHighlight(index: number, field: "name" | "description", value: string) {
    update({
      ...draft,
      menuHighlights: draft.menuHighlights.map((highlight, itemIndex) => itemIndex === index
        ? { ...highlight, [field]: value }
        : highlight),
    });
  }

  return (
    <details className="copy-editor restaurant-editor" open>
      <summary>Edit restaurant content <span>Menu and optional details save with this project</span></summary>
      <div className="restaurant-editor-content">
        <div className="restaurant-editor-heading">
          <div><strong>Menu highlights</strong><span>Use two to four dishes. Do not add prices or claims that were not supplied.</span></div>
          <button type="button" onClick={() => update({ ...draft, menuHighlights: [...draft.menuHighlights, { name: "", description: "" }] })} disabled={draft.menuHighlights.length >= 4}>Add highlight</button>
        </div>
        <div className="restaurant-editor-menu">
          {draft.menuHighlights.map((highlight, index) => {
            const nameError = fieldError(`Menu highlight ${index + 1} name`);
            const descriptionError = fieldError(`Menu highlight ${index + 1} description`);
            const nameId = `restaurant-menu-name-${index}`;
            const descriptionId = `restaurant-menu-description-${index}`;
            return (
              <fieldset className="restaurant-editor-dish" key={index}>
                <legend>Menu highlight {index + 1}</legend>
                <label className="restaurant-editor-field" htmlFor={nameId}>Dish name
                  <input id={nameId} maxLength={60} value={highlight.name} onChange={(event) => updateHighlight(index, "name", event.target.value)} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `${nameId}-error` : undefined} />
                  {nameError && <span id={`${nameId}-error`} className="site-settings-error">{nameError}</span>}
                </label>
                <label className="restaurant-editor-field" htmlFor={descriptionId}>Description
                  <textarea id={descriptionId} rows={2} maxLength={160} value={highlight.description} onChange={(event) => updateHighlight(index, "description", event.target.value)} aria-invalid={Boolean(descriptionError)} aria-describedby={descriptionError ? `${descriptionId}-error` : undefined} />
                  {descriptionError && <span id={`${descriptionId}-error`} className="site-settings-error">{descriptionError}</span>}
                </label>
                <button className="restaurant-remove-dish" type="button" onClick={() => update({ ...draft, menuHighlights: draft.menuHighlights.filter((_, itemIndex) => itemIndex !== index) })} disabled={draft.menuHighlights.length <= 2}>Remove highlight</button>
              </fieldset>
            );
          })}
        </div>
        {validation.errors.some((error) => error === "Keep between two and four menu highlights.") && <p className="restaurant-editor-error" role="alert">Keep between two and four menu highlights. A saved restaurant project needs at least two valid dishes.</p>}

        <label className="restaurant-editor-field" htmlFor="restaurant-story">Restaurant story <span>Optional; leave blank to omit this section.</span>
          <textarea id="restaurant-story" rows={3} maxLength={600} value={draft.story} onChange={(event) => update({ ...draft, story: event.target.value })} aria-invalid={Boolean(fieldError("Story must"))} aria-describedby={fieldError("Story must") ? "restaurant-story-error" : undefined} />
          {fieldError("Story must") && <span id="restaurant-story-error" className="site-settings-error">{fieldError("Story must")}</span>}
        </label>
        <div className="restaurant-editor-optionals">
          <label className="restaurant-editor-field" htmlFor="restaurant-location">Location <span>Optional; only enter a supplied location.</span>
            <input id="restaurant-location" maxLength={240} value={draft.location} onChange={(event) => update({ ...draft, location: event.target.value })} aria-invalid={Boolean(fieldError("Location must"))} aria-describedby={fieldError("Location must") ? "restaurant-location-error" : undefined} />
            {fieldError("Location must") && <span id="restaurant-location-error" className="site-settings-error">{fieldError("Location must")}</span>}
          </label>
          <label className="restaurant-editor-field" htmlFor="restaurant-hours">Opening hours <span>Optional; leave blank to omit.</span>
            <input id="restaurant-hours" maxLength={240} value={draft.openingHours} onChange={(event) => update({ ...draft, openingHours: event.target.value })} aria-invalid={Boolean(fieldError("Opening hours must"))} aria-describedby={fieldError("Opening hours must") ? "restaurant-hours-error" : undefined} />
            {fieldError("Opening hours must") && <span id="restaurant-hours-error" className="site-settings-error">{fieldError("Opening hours must")}</span>}
          </label>
        </div>
        {validation.errors.length > 0 && <p className="restaurant-editor-error" role="status">Correct the highlighted restaurant fields before saving or generating another page.</p>}
      </div>
    </details>
  );
}
