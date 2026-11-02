import { useState } from "react";
import type { EditableSection, GeneratedPage } from "@/lib/generation";
import { GeneratedWebsite } from "@/components/generated-website";
import type { SiteSettings } from "@/lib/site-settings";
import { SiteDestinationSchema, SiteNavigationEntrySchema, SiteNavigationTargetSchema, type SiteNavigationTarget } from "@/lib/site-settings";
import { AppearanceEditor } from "@/components/appearance-editor";
import type { Appearance } from "@/lib/site-settings";
import type { VisualStyle } from "@/lib/generation";
import type { HeroImageAsset } from "@/lib/site-image";
import type { ProjectPage } from "@/lib/projects";
import type { SiteNavigationPageReference } from "@/lib/site-navigation-options";
import { ProjectPageContentSchema } from "@/lib/projects";
import { RestaurantEditor } from "@/components/restaurant-editor";
import { FashionEditor } from "@/components/fashion-editor";
import { RealEstateEditor } from "@/components/real-estate-editor";
import type { FashionContent, RealEstateContent, SiteTemplate } from "@/lib/site-templates";
import { fashionEditorInstanceKey } from "@/lib/fashion-editor-state";
import { realEstateEditorInstanceKey } from "@/lib/real-estate-editor-state";
import {
  CUSTOM_SITE_DESTINATION,
  safeExternalNavigationTarget,
  siteNavigationTargetFromLegacy,
  siteNavigationTargetOptionValue,
  siteNavigationTargetOptions,
} from "@/lib/site-navigation-options";

type WebsitePreviewProps = {
  page: GeneratedPage | null;
  pageEditable: boolean;
  pages: readonly ProjectPage[];
  selectedPageId: string;
  allowSectionRegeneration: boolean;
  siteSettings: SiteSettings;
  onSiteSettingChange: (index: number, field: "label", value: string) => void;
  onSiteNavigationTargetChange: (index: number, target: SiteNavigationTarget) => void;
  onCtaDestinationChange: (value: string) => void;
  onPreviewNavigate: (pageId: string, anchor?: string) => void;
  layout: GeneratedPage["layout"];
  loading: boolean;
  onLayoutChange: (layout: GeneratedPage["layout"]) => void;
  sectionState: Record<EditableSection, { loading: boolean; error: string }>;
  onEdit: (section: EditableSection, value: string, featureIndex?: number) => void;
  onRegenerate: (section: EditableSection) => void;
  style: VisualStyle;
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  heroImage: HeroImageAsset | null;
  heroImageState: { loading: boolean; error: string };
  onGenerateHeroImage: () => void;
  onRemoveHeroImage: () => void;
  template: SiteTemplate;
  activeProjectId: string | null;
  restaurantEditorRevision: number;
  pageEditorRevisions: Record<string, number>;
  onRestaurantContentChange: (pageId: string, content: NonNullable<Extract<SiteTemplate, { id: "restaurant" }>["content"]> | null) => void;
  onFashionContentChange: (pageId: string, content: FashionContent | null) => void;
  onRealEstateContentChange: (pageId: string, content: RealEstateContent | null) => void;
};

export function WebsitePreview({ page, pageEditable, pages, selectedPageId, allowSectionRegeneration, layout, siteSettings, onSiteSettingChange, onSiteNavigationTargetChange, onCtaDestinationChange, onPreviewNavigate, loading, onLayoutChange, sectionState, onEdit, onRegenerate, style, appearance, onAppearanceChange, heroImage, heroImageState, onGenerateHeroImage, onRemoveHeroImage, template, activeProjectId, restaurantEditorRevision, pageEditorRevisions, onRestaurantContentChange, onFashionContentChange, onRealEstateContentChange }: WebsitePreviewProps) {
  const contentValidation = page ? ProjectPageContentSchema.safeParse({ headline: page.headline, description: page.subheadline, features: page.features, callToAction: page.callToAction }) : null;
  const contentIssue = (field: "headline" | "description" | "features" | "callToAction", featureIndex?: number) => contentValidation && !contentValidation.success
    ? contentValidation.error.issues.find((issue) => issue.path[0] === field && (featureIndex === undefined || issue.path[1] === featureIndex))?.message
    : undefined;
  return (
    <section className="preview-column" aria-label="Website preview">
      <div className="preview-header"><div><div className="section-kicker">THE FIRST LOOK</div><h2>Your live preview</h2></div><PreviewLayoutControls layout={layout} onLayoutChange={onLayoutChange} /></div>
      {page && pageEditable && <details className="copy-editor" open>
        <summary>Edit your page copy <span>Changes appear in the preview immediately</span></summary>
        <div className="copy-editor-grid">
          <EditorField label="Headline" section="headline" value={page.headline} maxLength={100} state={sectionState.headline} validationMessage={contentIssue("headline")} onChange={(value) => onEdit("headline", value)} onRegenerate={onRegenerate} allowRegeneration={allowSectionRegeneration} />
          <EditorField label="Description" section="description" value={page.subheadline} maxLength={240} multiline state={sectionState.description} validationMessage={contentIssue("description")} onChange={(value) => onEdit("description", value)} onRegenerate={onRegenerate} allowRegeneration={allowSectionRegeneration} />
          {template.id === "generic" && <div className="copy-editor-field copy-editor-wide"><span className="copy-editor-label">Features</span>
            {page.features.map((feature, index) => <label key={index} className="sr-only" htmlFor={`feature-${index}`}>Feature {index + 1}</label>)}
            {page.features.map((feature, index) => {
              const message = contentIssue("features", index);
              return <div key={index}><input id={`feature-${index}`} maxLength={90} value={feature} onChange={(event) => onEdit("features", event.target.value, index)} aria-label={`Feature ${index + 1}`} aria-invalid={Boolean(message)} aria-describedby={message ? `feature-${index}-error` : undefined} />{message && <span className="copy-field-error" id={`feature-${index}-error`}>{message}</span>}</div>;
            })}
            {allowSectionRegeneration && <SectionActions section="features" state={sectionState.features} onRegenerate={onRegenerate} />}
          </div>}
          <EditorField label="Call-to-action" section="callToAction" value={page.callToAction} maxLength={36} state={sectionState.callToAction} validationMessage={contentIssue("callToAction")} onChange={(value) => onEdit("callToAction", value)} onRegenerate={onRegenerate} allowRegeneration={allowSectionRegeneration} />
        </div>
      </details>}
      {pageEditable && pages.map((record) => <div key={`${activeProjectId ?? "draft"}:${record.id}:${restaurantEditorRevision}`} hidden={record.id !== selectedPageId}>
        {record.template.id === "restaurant" && <RestaurantEditor key={`${record.id}:${pageEditorRevisions[record.id] ?? 0}`} pageId={record.id} content={record.template.content} onChange={(content) => onRestaurantContentChange(record.id, content)} />}
        {record.template.id === "fashion" && <FashionEditor key={fashionEditorInstanceKey(activeProjectId, `${record.id}:${record.template.id}`, (pageEditorRevisions[record.id] ?? 0) + restaurantEditorRevision)} pageId={record.id} content={record.template.content} onChange={(content) => onFashionContentChange(record.id, content)} />}
        {record.template.id === "real-estate" && <RealEstateEditor key={realEstateEditorInstanceKey(activeProjectId, `${record.id}:${record.template.id}`, (pageEditorRevisions[record.id] ?? 0) + restaurantEditorRevision)} pageId={record.id} content={record.template.content} onChange={(content) => onRealEstateContentChange(record.id, content)} />}
      </div>)}
      <details className="copy-editor site-settings-editor" open>
        <summary>Edit navigation and links <span>Changes appear immediately</span></summary>
        <div className="copy-editor-grid">
          {siteSettings.navigation.map((entry, index) => <NavigationSettingEditor
            key={`${activeProjectId ?? "draft"}:${template.id}:${index}`}
            entry={entry}
            index={index}
            pages={pages}
            onChange={onSiteSettingChange}
            onTargetChange={onSiteNavigationTargetChange}
          />)}
          <div className="copy-editor-field">
            <label className="copy-editor-label" htmlFor="site-cta-destination">Call-to-action destination</label>
            <input id="site-cta-destination" maxLength={2048} value={siteSettings.ctaDestination} onChange={(event) => onCtaDestinationChange(event.target.value)} placeholder="https://example.com or #site-headline" aria-invalid={!SiteDestinationSchema.safeParse(siteSettings.ctaDestination).success} aria-describedby="site-cta-destination-help" />
            <span className="site-settings-help" id="site-cta-destination-help">{SiteDestinationSchema.safeParse(siteSettings.ctaDestination).success ? "Leave blank to show the call-to-action as text." : "Enter a safe http(s) URL, supported section anchor, or leave blank."}</span>
            {!SiteDestinationSchema.safeParse(siteSettings.ctaDestination).success && <span className="site-settings-error" role="status">Enter a safe http(s) URL, supported section anchor, or leave blank.</span>}
          </div>
        </div>
      </details>
      <AppearanceEditor key={activeProjectId ?? "draft"} style={style} appearance={appearance} onChange={onAppearanceChange} />
      <div className="hero-image-controls" aria-label="Hero image controls">
        <div><strong>Website hero image</strong><span>{heroImage ? "Saved with this project and included in HTML export." : "Optional image. The illustrated artwork remains as a fallback."}</span></div>
        <button type="button" onClick={onGenerateHeroImage} disabled={!page || heroImageState.loading} aria-busy={heroImageState.loading}>
          {heroImageState.loading ? "Generating image…" : heroImage ? "Regenerate image" : "Generate image"}
        </button>
        {heroImage && <button type="button" onClick={onRemoveHeroImage} disabled={heroImageState.loading}>Remove image</button>}
        {heroImageState.error && <span className="hero-image-error" role="alert">{heroImageState.error}</span>}
        <span className="sr-only" aria-live="polite">{heroImageState.loading ? "Generating hero image" : ""}</span>
      </div>
      <div className={`browser-frame ${loading ? "is-loading" : ""}`}>
        <div className="browser-bar"><div className="browser-dots"><i/><i/><i/></div><div className="address-bar"><span>⌑</span> yourbrand.com</div><span className="browser-more">···</span></div>
      {loading ? <div className="preview-loading"><div className="loading-orbit">✦</div><strong>Bringing your idea to life</strong><span>Putting the finishing touches on your page…</span><div className="loading-track"><i /></div></div> : page ? <GeneratedPreview page={page} siteSettings={siteSettings} heroImage={heroImage} template={template} pageId={selectedPageId} pages={pages} onNavigate={onPreviewNavigate} /> : <EmptyPreview />}
      </div>
      <div className="preview-caption"><span><i/> {page ? "PREVIEW UPDATED" : "PREVIEW AREA"}</span><span>{page ? page.style.toUpperCase() + " DIRECTION" : "YOUR SITE WILL APPEAR HERE"}</span></div>
    </section>
  );
}

export function PreviewLayoutControls({ layout, onLayoutChange }: { layout: GeneratedPage["layout"]; onLayoutChange: (layout: GeneratedPage["layout"]) => void }) {
  return <div className="viewport-switch" role="group" aria-label="Preview layout">
    <button type="button" className={layout === "editorial" ? "active" : ""} aria-label="Editorial layout" aria-pressed={layout === "editorial"} onClick={() => onLayoutChange("editorial")} title="Editorial layout"><span>▤</span></button>
    <button type="button" className={layout === "split" ? "active" : ""} aria-label="Split layout" aria-pressed={layout === "split"} onClick={() => onLayoutChange("split")} title="Split layout"><span>▥</span></button>
  </div>;
}

function NavigationSettingEditor({ entry, index, pages, onChange, onTargetChange }: {
  entry: SiteSettings["navigation"][number];
  index: number;
  pages: readonly ProjectPage[];
  onChange: WebsitePreviewProps["onSiteSettingChange"];
  onTargetChange: WebsitePreviewProps["onSiteNavigationTargetChange"];
}) {
  const homePage = pages.find((candidate) => candidate.id === "home");
  const currentTarget = entry.target ?? (homePage
    ? siteNavigationTargetFromLegacy(entry.destination, homePage)
    : { type: "none" as const });
  const options = siteNavigationTargetOptions(pages);
  const currentOptionValue = siteNavigationTargetOptionValue(currentTarget);
  const availableOption = options.find((option) => option.value === currentOptionValue);
  const unresolved = currentTarget.type === "unresolved";
  const [externalSelected, setExternalSelected] = useState(currentTarget.type === "external");
  const selection = unresolved ? currentOptionValue : externalSelected || currentTarget.type === "external" ? CUSTOM_SITE_DESTINATION : availableOption?.value ?? currentOptionValue;
  const [externalDraft, setExternalDraft] = useState(currentTarget.type === "external" ? currentTarget.url : "");
  const externalTarget = safeExternalNavigationTarget(externalDraft);
  const validLabel = SiteNavigationEntrySchema.shape.label.safeParse(entry.label).success;

  return <div className="copy-editor-field">
    <label className="copy-editor-label" htmlFor={`nav-label-${index}`}>Navigation {index + 1} label</label>
    <input id={`nav-label-${index}`} maxLength={40} value={entry.label} onChange={(event) => onChange(index, "label", event.target.value)} aria-invalid={!validLabel} aria-describedby={!validLabel ? `nav-label-help-${index}` : undefined} />
    {!validLabel && <span className="site-settings-error" id={`nav-label-help-${index}`}>Enter a label between 1 and 40 characters.</span>}
    <label className="copy-editor-label" htmlFor={`nav-destination-${index}`}>Navigation {index + 1} destination</label>
    <select
      id={`nav-destination-${index}`}
      value={selection}
      onChange={(event) => {
        if (event.target.value === CUSTOM_SITE_DESTINATION) {
          setExternalSelected(true);
          if (currentTarget.type === "external") setExternalDraft(currentTarget.url);
          return;
        }
        const option = options.find((candidate) => candidate.value === event.target.value);
        if (option) {
          setExternalSelected(false);
          onTargetChange(index, SiteNavigationTargetSchema.parse(option.target));
        }
      }}
      aria-describedby={`nav-destination-help-${index}`}
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      <option value={CUSTOM_SITE_DESTINATION}>External HTTP(S) URL</option>
      {unresolved && <option value={currentOptionValue}>Unresolved legacy destination (inactive)</option>}
      {!unresolved && !availableOption && <option value={currentOptionValue} disabled>Unavailable saved destination (inactive)</option>}
    </select>
    <span className="site-settings-help" id={`nav-destination-help-${index}`}>
      {unresolved ? `This saved destination is inactive and has not been changed: ${currentTarget.value}` : "Choose an existing page or a section that page renders. External URLs must use safe HTTP(S)."}
    </span>
    {selection === CUSTOM_SITE_DESTINATION && <>
      <label className="copy-editor-label" htmlFor={`nav-custom-destination-${index}`}>External HTTP(S) URL</label>
      <input
        id={`nav-custom-destination-${index}`}
        maxLength={2048}
        value={externalDraft}
        onChange={(event) => {
          setExternalDraft(event.target.value);
          const target = safeExternalNavigationTarget(event.target.value);
          if (target) onTargetChange(index, target);
        }}
        placeholder="https://example.com"
        aria-invalid={Boolean(externalDraft) && !externalTarget}
        aria-describedby={`nav-custom-destination-help-${index}`}
      />
      <span className={externalDraft && !externalTarget ? "site-settings-error" : "site-settings-help"} id={`nav-custom-destination-help-${index}`} role={externalDraft && !externalTarget ? "alert" : undefined}>{externalDraft && !externalTarget ? "Enter a safe HTTP(S) URL without credentials." : "Leave blank to keep the current destination until a valid URL is entered, or choose No destination."}</span>
    </>}
  </div>;
}

function SectionActions({ section, state, onRegenerate }: { section: EditableSection; state: { loading: boolean; error: string }; onRegenerate: (section: EditableSection) => void }) {
  return <div className="section-actions"><button type="button" onClick={() => onRegenerate(section)} disabled={state.loading} aria-busy={state.loading}>{state.loading ? "Regenerating…" : "Regenerate section"}</button>{state.error && <span role="alert">{state.error}</span>}<span aria-live="polite" className="sr-only">{state.loading ? "Regenerating section" : ""}</span></div>;
}

function EditorField({ label, section, value, maxLength, multiline = false, state, validationMessage, onChange, onRegenerate, allowRegeneration }: { label: string; section: EditableSection; value: string; maxLength: number; multiline?: boolean; state: { loading: boolean; error: string }; validationMessage?: string; onChange: (value: string) => void; onRegenerate: (section: EditableSection) => void; allowRegeneration: boolean }) {
  const id = `copy-${section}`;
  return <div className="copy-editor-field"><label className="copy-editor-label" htmlFor={id}>{label}</label>{multiline ? <textarea id={id} value={value} maxLength={maxLength} rows={2} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(validationMessage)} aria-describedby={validationMessage ? `${id}-error` : undefined} /> : <input id={id} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(validationMessage)} aria-describedby={validationMessage ? `${id}-error` : undefined} />}{validationMessage && <span className="copy-field-error" id={`${id}-error`}>{validationMessage}</span>}{allowRegeneration && <SectionActions section={section} state={state} onRegenerate={onRegenerate} />}</div>;
}

function EmptyPreview() {
  return <div className="empty-preview"><div className="empty-art"><div className="art-sun"/><div className="art-hill hill-back"/><div className="art-hill hill-front"/><div className="art-card"><span/><span/><span/></div></div><div className="empty-copy"><span className="preview-kicker">A FRESH CANVAS</span><h3>Your next great<br/>first impression.</h3><p>Fill in your business brief and we’ll bring a landing page concept to life.</p></div><div className="empty-footer"><span>Thoughtfully made for you</span><span>✦</span></div></div>;
}

function GeneratedPreview({ page, siteSettings, heroImage, template, pageId, pages, onNavigate }: { page: GeneratedPage; siteSettings: SiteSettings; heroImage: HeroImageAsset | null; template: SiteTemplate; pageId: string; pages: readonly ProjectPage[]; onNavigate: (pageId: string, anchor?: string) => void }) {
  const selectedRecord = pages.find((record) => record.id === pageId);
  const navigationPages: readonly SiteNavigationPageReference[] = pages.length ? pages : [{ id: pageId, template, kind: "home" }];
  return <GeneratedWebsite page={page} siteSettings={siteSettings} heroImage={heroImage} template={template} pageKind={selectedRecord?.kind ?? "home"} currentPageId={pageId} pages={navigationPages} onNavigate={onNavigate} />;
}
