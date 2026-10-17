import type { EditableSection, GeneratedPage } from "@/lib/generation";
import { GeneratedWebsite } from "@/components/generated-website";

type WebsitePreviewProps = {
  page: GeneratedPage | null;
  layout: GeneratedPage["layout"];
  loading: boolean;
  onLayoutChange: (layout: GeneratedPage["layout"]) => void;
  sectionState: Record<EditableSection, { loading: boolean; error: string }>;
  onEdit: (section: EditableSection, value: string, featureIndex?: number) => void;
  onRegenerate: (section: EditableSection) => void;
};

export function WebsitePreview({ page, layout, loading, onLayoutChange, sectionState, onEdit, onRegenerate }: WebsitePreviewProps) {
  return (
    <section className="preview-column" aria-label="Website preview">
      <div className="preview-header"><div><div className="section-kicker">THE FIRST LOOK</div><h2>Your live preview</h2></div><div className="viewport-switch" aria-label="Preview layout"><button type="button" className={layout === "editorial" ? "active" : ""} aria-pressed={layout === "editorial"} onClick={() => onLayoutChange("editorial")} title="Editorial layout"><span>▤</span></button><button type="button" className={layout === "split" ? "active" : ""} aria-pressed={layout === "split"} onClick={() => onLayoutChange("split")} title="Split layout"><span>▥</span></button></div></div>
      {page && <details className="copy-editor" open>
        <summary>Edit your page copy <span>Changes appear in the preview immediately</span></summary>
        <div className="copy-editor-grid">
          <EditorField label="Headline" section="headline" value={page.headline} maxLength={100} state={sectionState.headline} onChange={(value) => onEdit("headline", value)} onRegenerate={onRegenerate} />
          <EditorField label="Description" section="description" value={page.subheadline} maxLength={240} multiline state={sectionState.description} onChange={(value) => onEdit("description", value)} onRegenerate={onRegenerate} />
          <div className="copy-editor-field copy-editor-wide"><span className="copy-editor-label">Features</span>
            {page.features.map((feature, index) => <label key={index} className="sr-only" htmlFor={`feature-${index}`}>Feature {index + 1}</label>)}
            {page.features.map((feature, index) => <input key={index} id={`feature-${index}`} maxLength={90} value={feature} onChange={(event) => onEdit("features", event.target.value, index)} aria-label={`Feature ${index + 1}`} />)}
            <SectionActions section="features" state={sectionState.features} onRegenerate={onRegenerate} />
          </div>
          <EditorField label="Call-to-action" section="callToAction" value={page.callToAction} maxLength={36} state={sectionState.callToAction} onChange={(value) => onEdit("callToAction", value)} onRegenerate={onRegenerate} />
        </div>
      </details>}
      <div className={`browser-frame ${loading ? "is-loading" : ""}`}>
        <div className="browser-bar"><div className="browser-dots"><i/><i/><i/></div><div className="address-bar"><span>⌑</span> yourbrand.com</div><span className="browser-more">···</span></div>
        {loading ? <div className="preview-loading"><div className="loading-orbit">✦</div><strong>Bringing your idea to life</strong><span>Putting the finishing touches on your page…</span><div className="loading-track"><i /></div></div> : page ? <GeneratedPreview page={page} /> : <EmptyPreview />}
      </div>
      <div className="preview-caption"><span><i/> {page ? "PREVIEW UPDATED" : "PREVIEW AREA"}</span><span>{page ? page.style.toUpperCase() + " DIRECTION" : "YOUR SITE WILL APPEAR HERE"}</span></div>
    </section>
  );
}

function SectionActions({ section, state, onRegenerate }: { section: EditableSection; state: { loading: boolean; error: string }; onRegenerate: (section: EditableSection) => void }) {
  return <div className="section-actions"><button type="button" onClick={() => onRegenerate(section)} disabled={state.loading} aria-busy={state.loading}>{state.loading ? "Regenerating…" : "Regenerate section"}</button>{state.error && <span role="alert">{state.error}</span>}<span aria-live="polite" className="sr-only">{state.loading ? "Regenerating section" : ""}</span></div>;
}

function EditorField({ label, section, value, maxLength, multiline = false, state, onChange, onRegenerate }: { label: string; section: EditableSection; value: string; maxLength: number; multiline?: boolean; state: { loading: boolean; error: string }; onChange: (value: string) => void; onRegenerate: (section: EditableSection) => void }) {
  const id = `copy-${section}`;
  return <div className="copy-editor-field"><label className="copy-editor-label" htmlFor={id}>{label}</label>{multiline ? <textarea id={id} value={value} maxLength={maxLength} rows={2} onChange={(event) => onChange(event.target.value)} /> : <input id={id} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />}<SectionActions section={section} state={state} onRegenerate={onRegenerate} /></div>;
}

function EmptyPreview() {
  return <div className="empty-preview"><div className="empty-art"><div className="art-sun"/><div className="art-hill hill-back"/><div className="art-hill hill-front"/><div className="art-card"><span/><span/><span/></div></div><div className="empty-copy"><span className="preview-kicker">A FRESH CANVAS</span><h3>Your next great<br/>first impression.</h3><p>Fill in your business brief and we’ll bring a landing page concept to life.</p></div><div className="empty-footer"><span>Thoughtfully made for you</span><span>✦</span></div></div>;
}

function GeneratedPreview({ page }: { page: GeneratedPage }) {
  return <GeneratedWebsite page={page} />;
}
