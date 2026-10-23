import type { FormEvent } from "react";
import { VISUAL_STYLES, type BusinessBrief } from "@/lib/generation";
import type { SiteTemplateId } from "@/lib/site-templates";

type BriefFormProps = {
  brief: BusinessBrief;
  loading: boolean;
  onChange: <K extends keyof BusinessBrief>(key: K, value: BusinessBrief[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, templateId: SiteTemplateId) => void;
};

const styleDetails: Record<BusinessBrief["style"], { color: string; mark: string }> = {
  Minimalist: { color: "#dfe7df", mark: "○" },
  Luxury: { color: "#e8dfd1", mark: "✳" },
  Bold: { color: "#f1d4c5", mark: "↗" },
  Playful: { color: "#eadcf1", mark: "✿" },
  Professional: { color: "#d8e5ee", mark: "▧" },
};

export function BriefForm({ brief, loading, onChange, onSubmit }: BriefFormProps) {
  return (
    <form className="brief-card" onSubmit={(event) => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      const templateId = submitter instanceof HTMLButtonElement && ["restaurant", "fashion", "real-estate"].includes(submitter.value)
        ? submitter.value as SiteTemplateId
        : "generic";
      onSubmit(event, templateId);
    }}>
      <div className="card-heading"><div><div className="section-kicker">THE STARTING POINT</div><h2>Your business brief</h2><p>A few details help us capture your story.</p></div><span className="required-label"><i /> REQUIRED</span></div>
      <div className="form-fields">
        <label className="field"><span>Business name <b>*</b></span><input required maxLength={60} value={brief.businessName} onChange={(event) => onChange("businessName", event.target.value)} placeholder="e.g. Sunday Supply Co." /></label>
        <label className="field"><span>What does your business do? <b>*</b></span><textarea required maxLength={240} rows={3} value={brief.description} onChange={(event) => onChange("description", event.target.value)} placeholder="Give us the short and sweet version…" /><small>{brief.description.length}/240</small></label>
        <label className="field"><span>Who are you here for? <b>*</b></span><input required maxLength={100} value={brief.audience} onChange={(event) => onChange("audience", event.target.value)} placeholder="e.g. Design lovers & slow-living devotees" /></label>
        <label className="field"><span>Your main product or service <b>*</b></span><input required maxLength={80} value={brief.offering} onChange={(event) => onChange("offering", event.target.value)} placeholder="e.g. Thoughtful home essentials" /></label>
        <label className="field"><span>Primary call to action <b>*</b></span><input required maxLength={36} value={brief.callToAction} onChange={(event) => onChange("callToAction", event.target.value)} placeholder="e.g. Explore the collection" /></label>
      </div>
      <fieldset className="style-fieldset"><legend>Pick your visual direction <span>Choose one</span></legend><div className="style-options">{VISUAL_STYLES.map((style) => <button key={style} type="button" className={`style-option ${brief.style === style ? "selected" : ""}`} aria-pressed={brief.style === style} onClick={() => onChange("style", style)}><span className="style-swatch" style={{ backgroundColor: styleDetails[style].color }}>{styleDetails[style].mark}</span><span>{style}</span>{brief.style === style && <span className="selected-check">✓</span>}</button>)}</div></fieldset>
      <div className="form-bottom"><span><span className="sparkle">✦</span> Takes about 30 seconds</span><div className="generation-actions"><button className="generate-button" type="submit" name="templateId" value="generic" disabled={loading} aria-busy={loading}>{loading ? <><span className="spinner" /> Creating your page…</> : <>Generate website <span>↗</span></>}</button><button className="generate-button restaurant-generate-button" type="submit" name="templateId" value="restaurant" disabled={loading} aria-busy={loading}>{loading ? <><span className="spinner" /> Creating your page…</> : <>Generate restaurant site <span>↗</span></>}</button><button className="generate-button fashion-generate-button" type="submit" name="templateId" value="fashion" disabled={loading} aria-busy={loading}>{loading ? <><span className="spinner" /> Creating your page…</> : <>Generate fashion site <span>↗</span></>}</button><button className="generate-button real-estate-generate-button" type="submit" name="templateId" value="real-estate" disabled={loading} aria-busy={loading}>{loading ? <><span className="spinner" /> Creating your page…</> : <>Generate real estate site <span>↗</span></>}</button></div></div>
    </form>
  );
}
