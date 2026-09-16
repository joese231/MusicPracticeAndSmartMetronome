"use client";

import React, { useState } from "react";

export function PracticeNotes({ notes, onSave }: {
  notes: string | null;
  onSave: (notes: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(draft.trim() || null);
      setEditing(false);
    } catch {
      setError("Could not save notes. Your text is still here; please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-practice-notes aria-label="Practice notes" className="relative z-10 w-full max-w-2xl rounded-lg border border-bg-border bg-bg-elevated p-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-200">Practice notes</h2>
        {!editing && <button type="button" className="text-sm text-accent hover:underline" onClick={() => {
          setDraft(notes ?? "");
          setError(null);
          setEditing(true);
        }}>{notes ? "Edit notes" : "Add notes"}</button>}
      </div>
      {editing ? <div className="mt-3 space-y-3">
        <textarea aria-label="Practice notes" autoFocus rows={4} value={draft} disabled={busy}
          onChange={(e) => setDraft(e.target.value)} className="field-input w-full"
          placeholder="What should you focus on next time?" />
        <p className="text-xs text-neutral-400">Saved with this song or exercise for future sessions.</p>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex gap-3">
          <button type="button" disabled={busy} onClick={() => void save()} className="rounded bg-accent px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Saving…" : "Save notes"}</button>
          <button type="button" disabled={busy} onClick={() => setEditing(false)} className="rounded border border-bg-border px-3 py-2 text-sm text-neutral-300">Cancel</button>
        </div>
      </div> : <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-neutral-300">{notes || "Add reminders or observations while you practice."}</p>}
    </section>
  );
}
