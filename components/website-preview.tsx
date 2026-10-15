import type { GeneratedPage } from "@/lib/generation";

type WebsitePreviewProps = {
  page: GeneratedPage | null;
  layout: GeneratedPage["layout"];
  loading: boolean;
  onLayoutChange: (layout: GeneratedPage["layout"]) => void;
};

export function WebsitePreview({ page, layout, loading, onLayoutChange }: WebsitePreviewProps) {
  return (
    <section className="preview-column" aria-label="Website preview">
      <div className="preview-header"><div><div className="section-kicker">THE FIRST LOOK</div><h2>Your live preview</h2></div><div className="viewport-switch" aria-label="Preview layout"><button type="button" className={layout === "editorial" ? "active" : ""} aria-pressed={layout === "editorial"} onClick={() => onLayoutChange("editorial")} title="Editorial layout"><span>▤</span></button><button type="button" className={layout === "split" ? "active" : ""} aria-pressed={layout === "split"} onClick={() => onLayoutChange("split")} title="Split layout"><span>▥</span></button></div></div>
      <div className={`browser-frame ${loading ? "is-loading" : ""}`}>
        <div className="browser-bar"><div className="browser-dots"><i/><i/><i/></div><div className="address-bar"><span>⌑</span> yourbrand.com</div><span className="browser-more">···</span></div>
        {loading ? <div className="preview-loading"><div className="loading-orbit">✦</div><strong>Bringing your idea to life</strong><span>Putting the finishing touches on your page…</span><div className="loading-track"><i /></div></div> : page ? <GeneratedPreview page={page} /> : <EmptyPreview />}
      </div>
      <div className="preview-caption"><span><i/> {page ? "PREVIEW UPDATED" : "PREVIEW AREA"}</span><span>{page ? page.style.toUpperCase() + " DIRECTION" : "YOUR SITE WILL APPEAR HERE"}</span></div>
    </section>
  );
}

function EmptyPreview() {
  return <div className="empty-preview"><div className="empty-art"><div className="art-sun"/><div className="art-hill hill-back"/><div className="art-hill hill-front"/><div className="art-card"><span/><span/><span/></div></div><div className="empty-copy"><span className="preview-kicker">A FRESH CANVAS</span><h3>Your next great<br/>first impression.</h3><p>Fill in your business brief and we’ll bring a landing page concept to life.</p></div><div className="empty-footer"><span>Thoughtfully made for you</span><span>✦</span></div></div>;
}

function GeneratedPreview({ page }: { page: GeneratedPage }) {
  const styleClass = page.style.toLowerCase();
  return <div className={`site-mock ${styleClass} ${page.layout}`}>
    <div className="site-nav"><span className="site-logo">{page.businessName}</span><span className="site-nav-links"><span>Our story</span><span>Collections</span><span>Journal</span></span><button type="button">Shop <span>↗</span></button></div>
    <div className="site-hero"><div className="site-copy"><span className="preview-kicker">MADE WITH INTENTION <i>✦</i></span><h3>{page.headline}</h3><p>{page.subheadline}</p><div className="site-actions"><button type="button">{page.callToAction || "Discover more"} <span>↗</span></button><span>For {page.audience.toLowerCase()}</span></div></div><div className="site-art" aria-hidden="true"><div className="site-arch"><div className="site-orb"/><div className="site-vase vase-one"/><div className="site-vase vase-two"/><div className="site-table"/><span className="art-spark">✳</span></div><span className="art-caption">Fig. 01 — The everyday edit</span></div></div>
    <div className="site-bottom"><span>Designed for the everyday</span><span>01 / 03</span></div>
  </div>;
}