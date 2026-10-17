"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Diálogo modal sobre <dialog> nativo: trae foco atrapado, cierre con Esc y backdrop accesibles. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // autoFocus de React corre antes de que el <dialog> esté abierto y se pierde: se marca con data-autofocus
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // clic en el backdrop
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-surface p-0 text-foreground shadow-2xl"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="mb-4 font-display text-xl font-bold">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
