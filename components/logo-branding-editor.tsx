"use client";

import { useRef } from "react";
import Image from "next/image";
import type { SiteLogoDisplayMode } from "@/lib/site-settings";

export function LogoBrandingEditor({
  logoUrl,
  logoDisplayMode,
  loading,
  error,
  unavailable,
  onUpload,
  onRemove,
  onDisplayModeChange,
}: {
  logoUrl: string | null;
  logoDisplayMode: SiteLogoDisplayMode;
  loading: boolean;
  error: string;
  unavailable: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onDisplayModeChange: (mode: SiteLogoDisplayMode) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseFile = () => inputRef.current?.click();

  return <section className="logo-branding-editor" aria-labelledby="site-logo-heading">
    <div className="logo-branding-heading">
      <div><h3 id="site-logo-heading">Business logo</h3><p>Upload a PNG, JPEG, or WebP file up to 2 MB.</p></div>
      {logoUrl && <Image className="logo-upload-preview" src={logoUrl} alt="Uploaded business logo preview" width={150} height={48} unoptimized />}
    </div>
    <input
      ref={inputRef}
      className="sr-only"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      aria-label="Choose a PNG, JPEG, or WebP business logo"
      aria-describedby="site-logo-help site-logo-error"
      disabled={loading}
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) onUpload(file);
      }}
    />
    <div className="logo-branding-actions">
      <button type="button" onClick={chooseFile} disabled={loading} aria-busy={loading}>
        {loading ? "Checking logo…" : logoUrl ? "Replace logo" : "Upload logo"}
      </button>
      {(logoUrl || unavailable) && <button type="button" onClick={onRemove} disabled={loading}>Remove logo</button>}
    </div>
    <fieldset className="logo-display-options" disabled={loading}>
      <legend>Logo display</legend>
      <label><input type="radio" name="site-logo-display" value="image-only" checked={logoDisplayMode === "image-only"} onChange={() => onDisplayModeChange("image-only")} /> Image only</label>
      <label><input type="radio" name="site-logo-display" value="image-with-name" checked={logoDisplayMode === "image-with-name"} onChange={() => onDisplayModeChange("image-with-name")} /> Image + business name</label>
    </fieldset>
    <p className="site-settings-help" id="site-logo-help">Your logo is stored in this browser with its project. It does not sync to another browser or device.</p>
    {unavailable && <p className="site-settings-error" role="status">The saved logo is unavailable. Remove it to use text branding, or upload a replacement.</p>}
    {error && <p className="site-settings-error" id="site-logo-error" role="alert">{error}</p>}
    {!error && <span className="sr-only" id="site-logo-error" />}
  </section>;
}
