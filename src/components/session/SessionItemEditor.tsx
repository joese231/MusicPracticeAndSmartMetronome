"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function SessionItemEditor({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-label={title}
      className="fixed inset-0 z-50 max-h-[90dvh] w-[min(95vw,48rem)] overflow-y-auto rounded-xl border border-bg-border bg-bg-elevated p-6 text-neutral-100 backdrop:bg-black/70">
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="mb-5 text-sm text-neutral-400">Tempo and notes update now. Mode, duration, trouble spots and block sequence apply to the next session.</p>
      {children}
    </dialog>
  );
}
