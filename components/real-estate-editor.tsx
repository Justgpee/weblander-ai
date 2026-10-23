"use client";

import { useState } from "react";
import { realEstateContentToDraft, validateRealEstateContentDraft, type RealEstateContentDraft } from "@/lib/real-estate-editor-state";
import type { RealEstateContent } from "@/lib/site-templates";

type RealEstateEditorProps = {
  content: RealEstateContent;
  onChange: (content: RealEstateContent | null) => void;
};

export function RealEstateEditor({ content, onChange }: RealEstateEditorProps) {
  const [draft, setDraft] = useState<RealEstateContentDraft>(() => realEstateContentToDraft(content));
  const validation = validateRealEstateContentDraft(draft);

  function update(next: RealEstateContentDraft) {
    setDraft(next);
    const result = validateRealEstateContentDraft(next);
    onChange(result.success ? result.data : null);
  }

  function fieldError(prefix: string) {
    return validation.errors.find((error) => error.startsWith(prefix));
  }

  function updateProperty(index: number, field: "name" | "description", value: string) {
    update({
      ...draft,
      featuredProperties: draft.featuredProperties.map((property, propertyIndex) => propertyIndex === index
        ? { ...property, [field]: value }
        : property),
    });
  }

  return (
    <details className="copy-editor real-estate-editor" open>
      <summary>Edit real estate content <span>Property highlights and optional agency story save with this project</span></summary>
      <div className="restaurant-editor-content real-estate-editor-content">
        <div className="restaurant-editor-heading">
          <div><strong>Featured property highlights</strong><span>Use descriptive concepts grounded in your brief; these are not verified active listings.</span></div>
          <button type="button" onClick={() => update({ ...draft, featuredProperties: [...draft.featuredProperties, { name: "", description: "" }] })} disabled={draft.featuredProperties.length >= 4}>Add highlight</button>
        </div>
        <div className="restaurant-editor-menu">
          {draft.featuredProperties.map((property, index) => {
            const nameError = fieldError(`Featured property ${index + 1} name`);
            const descriptionError = fieldError(`Featured property ${index + 1} description`);
            const nameId = `real-estate-property-name-${index}`;
            const descriptionId = `real-estate-property-description-${index}`;
            return (
              <fieldset className="restaurant-editor-dish" key={index}>
                <legend>Featured property highlight {index + 1}</legend>
                <label className="restaurant-editor-field" htmlFor={nameId}>Highlight name
                  <input id={nameId} value={property.name} onChange={(event) => updateProperty(index, "name", event.target.value)} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `${nameId}-error` : undefined} />
                  {nameError && <span id={`${nameId}-error`} className="site-settings-error">{nameError}</span>}
                </label>
                <label className="restaurant-editor-field" htmlFor={descriptionId}>Description
                  <textarea id={descriptionId} rows={2} value={property.description} onChange={(event) => updateProperty(index, "description", event.target.value)} aria-invalid={Boolean(descriptionError)} aria-describedby={descriptionError ? `${descriptionId}-error` : undefined} />
                  {descriptionError && <span id={`${descriptionId}-error`} className="site-settings-error">{descriptionError}</span>}
                </label>
                <button className="restaurant-remove-dish" type="button" onClick={() => update({ ...draft, featuredProperties: draft.featuredProperties.filter((_, propertyIndex) => propertyIndex !== index) })} disabled={draft.featuredProperties.length <= 2}>Remove highlight</button>
              </fieldset>
            );
          })}
        </div>
        {validation.errors.some((error) => error === "Keep between two and four featured property highlights.") && <p className="restaurant-editor-error" role="alert">Keep between two and four featured property highlights. A saved Real Estate project needs at least two valid highlights.</p>}
        <label className="restaurant-editor-field" htmlFor="real-estate-agency-story">Agency story <span>Optional; leave blank to omit this section.</span>
          <textarea id="real-estate-agency-story" rows={3} value={draft.agencyStory} onChange={(event) => update({ ...draft, agencyStory: event.target.value })} aria-invalid={Boolean(fieldError("Agency story must"))} aria-describedby={fieldError("Agency story must") ? "real-estate-agency-story-error" : undefined} />
          {fieldError("Agency story must") && <span id="real-estate-agency-story-error" className="site-settings-error">{fieldError("Agency story must")}</span>}
        </label>
        {validation.errors.length > 0 && <p className="restaurant-editor-error" role="status">Correct the highlighted Real Estate fields before saving or generating another page.</p>}
      </div>
    </details>
  );
}
