"use client";

import { useEffect, useRef } from "react";

type UnsavedChangesDialogProps = {
  open: boolean;
  canSave: boolean;
  error: string;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
  onKeepEditing: () => void;
};

export function UnsavedChangesDialog({ open, canSave, error, onSaveAndContinue, onDiscardAndContinue, onKeepEditing }: UnsavedChangesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.focus();
  }, [open]);

  if (!open) return null;
  return <div className="project-overlay unsaved-overlay">
    <dialog ref={dialogRef} className="unsaved-dialog" aria-labelledby="unsaved-title" aria-describedby="unsaved-description" tabIndex={-1} onCancel={(event) => { event.preventDefault(); onKeepEditing(); }}>
      <div className="section-kicker">UNSAVED WORK</div>
      <h2 id="unsaved-title">Save before you leave?</h2>
      <p id="unsaved-description">Your latest changes have not been saved. Save them, explicitly discard them, or keep editing.</p>
      {error && <p className="project-storage-error" role="alert">{error}</p>}
      <div className="unsaved-actions">
        {canSave && <button type="button" className="generate-button" onClick={onSaveAndContinue}>Save and continue</button>}
        <button type="button" className="discard-button" onClick={onDiscardAndContinue}>Discard and continue</button>
        <button type="button" className="cancel-button" onClick={onKeepEditing}>Keep editing</button>
      </div>
    </dialog>
  </div>;
}
