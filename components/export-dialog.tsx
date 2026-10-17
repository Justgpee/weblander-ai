"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateCtaDestination } from "@/lib/website-export";

type ExportDialogProps = {
  open: boolean;
  onClose: () => void;
  onExport: (destination: string) => void;
};

export function ExportDialog({ open, onClose, onExport }: ExportDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      validateCtaDestination(destination);
    } catch {
      setError("Enter a valid http(s) URL, #top, or #site-headline, or leave the field empty.");
      return;
    }
    try {
      onExport(destination);
      setError("");
      setDestination("");
      onClose();
    } catch {
      setError("The file could not be created. Check the page content and try again.");
    }
  }

  return <dialog ref={dialogRef} className="export-dialog" aria-labelledby="export-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="section-kicker">READY TO TAKE IT WITH YOU</div>
      <h2 id="export-dialog-title">Export your website</h2>
      <p>Your latest edits and selected layout will be included in a standalone HTML file.</p>
      <form onSubmit={submit}>
        <label htmlFor="export-cta-destination">Call-to-action destination <span>(optional)</span></label>
        <input id="export-cta-destination" type="text" inputMode="url" autoComplete="url" placeholder="https://example.com or #top" value={destination} onChange={(event) => { setDestination(event.target.value); setError(""); }} aria-describedby="export-destination-help" aria-invalid={Boolean(error)} />
        <small id="export-destination-help">Without a destination, the call-to-action is displayed as text.</small>
        {error && <p className="export-error" role="alert">{error}</p>}
        <div className="export-actions"><button type="button" onClick={onClose}>Cancel</button><button className="generate-button" type="submit">Download HTML <span aria-hidden="true">↓</span></button></div>
      </form>
  </dialog>;
}
