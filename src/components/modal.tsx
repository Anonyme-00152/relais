"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Boîte de dialogue native (<dialog>) : focus piégé, Échap, fond flouté. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  bare = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  bare?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto w-[calc(100%-1.5rem)] rounded-3xl border border-line bg-card p-0 text-ink shadow-[var(--shadow-lg)] backdrop:bg-transparent ${
        wide ? "max-w-5xl" : "max-w-lg"
      }`}
    >
      {open && (
        <div className={bare ? "" : "p-6 sm:p-7"}>
          {!bare && (
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <button type="button" className="btn btn-ghost btn-icon -mt-1 -mr-2" onClick={onClose} aria-label="Fermer">
                <X className="size-5" />
              </button>
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
