"use client";

import { useRef, useState, type FormEvent } from "react";
import { EMPTY_BRIEF, EditableSectionSchema, GeneratedPageSchema, SectionContentSchemas, type BusinessBrief, type EditableSection, type GeneratedPage } from "@/lib/generation";
import { BriefForm } from "@/components/brief-form";
import { WebsitePreview } from "@/components/website-preview";
import { mergeGeneratedSectionIfUnchanged } from "@/lib/page-editing";

type SectionState = Record<EditableSection, { loading: boolean; error: string }>;
const EMPTY_SECTION_STATE: SectionState = {
  headline: { loading: false, error: "" }, description: { loading: false, error: "" },
  features: { loading: false, error: "" }, callToAction: { loading: false, error: "" },
};

export default function Home() {
  const [brief, setBrief] = useState<BusinessBrief>(EMPTY_BRIEF);
  const [page, setPage] = useState<GeneratedPage | null>(null);
  const [layout, setLayout] = useState<GeneratedPage["layout"]>("editorial");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [sectionState, setSectionState] = useState<SectionState>(EMPTY_SECTION_STATE);
  const inFlightSections = useRef(new Set<EditableSection>());
  const sectionEditRevisions = useRef<Record<EditableSection, number>>({ headline: 0, description: 0, features: 0, callToAction: 0 });

  function updateBrief<K extends keyof BusinessBrief>(key: K, value: BusinessBrief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setNotice("");
    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "message" in result.error && typeof result.error.message === "string"
          ? result.error.message
          : "We couldn’t generate your page right now. Please try again.";
        setNotice(message);
        return;
      }
      const generatedPage = GeneratedPageSchema.safeParse(result.data);
      if (!generatedPage.success) {
        setNotice("The generation service returned an invalid page. Please try again.");
        return;
      }
      for (const section of Object.keys(sectionEditRevisions.current) as EditableSection[]) {
        sectionEditRevisions.current[section] += 1;
      }
      setPage({ ...generatedPage.data, layout });
      setNotice("Your landing page is ready.");
    } catch {
      setNotice("Couldn’t connect to the generation service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function changeLayout(next: GeneratedPage["layout"]) {
    setLayout(next);
    setPage((current) => current ? { ...current, layout: next } : current);
  }

  function editGeneratedSection(section: EditableSection, value: string, featureIndex?: number) {
    sectionEditRevisions.current[section] += 1;
    setPage((current) => {
      if (!current) return current;
      if (section === "headline") return { ...current, headline: value };
      if (section === "description") return { ...current, subheadline: value };
      if (section === "callToAction") return { ...current, callToAction: value };
      if (featureIndex === undefined) return current;
      return { ...current, features: current.features.map((feature, index) => index === featureIndex ? value : feature) };
    });
    setSectionState((current) => ({ ...current, [section]: { ...current[section], error: "" } }));
  }

  async function regenerateSection(section: EditableSection) {
    if (inFlightSections.current.has(section)) return;
    inFlightSections.current.add(section);
    const requestedRevision = sectionEditRevisions.current[section];
    setSectionState((current) => ({ ...current, [section]: { loading: true, error: "" } }));
    try {
      const response = await fetch("/api/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, section }),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
        const code = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "code" in result.error && typeof result.error.code === "string"
          ? result.error.code
          : "";
        const message = code === "GENERATION_NOT_CONFIGURED" ? "AI generation is not configured on this server."
          : code === "GENERATION_REFUSED" ? "The request could not be generated. Revise the brief and try again."
          : code === "INVALID_GENERATION" ? "The generation service returned invalid content. Please try again."
          : "We couldn’t regenerate this section. Please try again.";
        throw new Error(message);
      }
      const parsedSection = EditableSectionSchema.safeParse(section);
      if (!parsedSection.success) throw new Error("This section cannot be regenerated.");
      const validated = SectionContentSchemas[parsedSection.data].safeParse(result.data);
      if (!validated.success) throw new Error("The generation service returned an invalid section. Please try again.");
      setPage((current) => current ? mergeGeneratedSectionIfUnchanged(
        current,
        section,
        validated.data,
        requestedRevision,
        sectionEditRevisions.current[section],
      ) : current);
    } catch (error) {
      const safeMessage = error instanceof Error && [
        "AI generation is not configured on this server.",
        "The request could not be generated. Revise the brief and try again.",
        "The generation service returned invalid content. Please try again.",
        "The generation service returned an invalid section. Please try again.",
      ].includes(error.message) ? error.message : "We couldn’t regenerate this section. Please try again.";
      setSectionState((current) => ({ ...current, [section]: { loading: true, error: safeMessage } }));
    } finally {
      inFlightSections.current.delete(section);
      setSectionState((current) => ({ ...current, [section]: { ...current[section], loading: false } }));
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#workspace" aria-label="WebLander AI home"><span className="brand-mark">W</span><span>WebLander AI</span></a>
        <div className="workspace-label">WORKSPACE</div>
        <a className="nav-item active" href="#workspace"><span className="nav-icon">✳</span> Website studio</a>
        <a className="nav-item muted" href="#projects"><span className="nav-icon">▤</span> My projects <span className="soon">SOON</span></a>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-spark">✦</span><strong>Made for big ideas.</strong><p>Your next great website starts with a clear brief.</p><a href="#brief">Start creating <span>↗</span></a></div><div className="profile"><div className="avatar">N</div><div><strong>New workspace</strong><span>Free plan</span></div><span className="profile-menu">···</span></div></div>
      </aside>

      <section className="main-area" id="workspace">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Website studio</strong></div><div className="top-actions"><span className="prototype-pill"><i /> AI generation</span><button className="help-button" type="button" aria-label="Help">?</button></div></header>
        <div className="workspace-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR CREATIVE STUDIO</div><h1>Let’s make something <em>remarkable.</em></h1><p>Tell us about your business. We’ll turn your big idea into a page worth landing on.</p></div><div className="step-badge"><span>01</span><span className="step-line"/><span>02</span><span className="step-line"/><span>03</span></div></div>
          <div className="prototype-note"><span className="note-icon">✦</span><span><strong>AI-powered page concepts.</strong> Your brief is used to create landing-page copy. Review generated content before publishing.</span><button type="button" aria-label="Dismiss generation note" onClick={(e) => e.currentTarget.parentElement?.remove()}>×</button></div>
          <div className="studio-grid" id="brief">
            <BriefForm brief={brief} onChange={updateBrief} onSubmit={submit} loading={loading} />
            <WebsitePreview page={page} layout={layout} onLayoutChange={changeLayout} loading={loading} sectionState={sectionState} onEdit={editGeneratedSection} onRegenerate={regenerateSection} />
          </div>
          {notice && <p className={`generation-notice ${notice.includes("ready") ? "success" : ""}`} role="status" aria-live="polite">{notice}</p>}
          <footer className="page-footer"><span>© 2025 WebLander AI</span><span>Built for the next big thing <b>✦</b></span><a href="#brief">Feedback <span>↗</span></a></footer>
        </div>
      </section>
    </main>
  );
}
