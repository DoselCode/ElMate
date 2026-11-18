"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PaperPlaneRight, X } from "@phosphor-icons/react";
import { whatsappLink } from "@/shared/whatsapp";

/** Verde de WhatsApp oscurecido: el ícono y el texto blancos mantienen contraste (≈4:1). */
const GREEN_BG = "bg-[#158f4a]";
const GREEN = `${GREEN_BG} hover:bg-[#117a3e]`;

/** Ícono de chat de WhatsApp (trazo, toma el color del texto). */
function ChatIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a8.962 8.962 0 01-4.57-1.24L3 21l1.28-4.29A8.963 8.963 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 8.75s.5 1.75 1.5 2.75 2.75 1.5 2.75 1.5l1.25-1.25s.75.25 1.5 1-.75 2.25-.75 2.25c-1 1-3.5.5-6-2s-3-5-2-6c0 0 1.25-1.5 2.25-.75s1 1.5 1 1.5l-1.5 1z"
      />
    </svg>
  );
}

const TOPICS = [
  "Quiero consultar por un producto",
  "Quiero hacer un pedido",
  "Quiero un grabado personalizado",
  "¿Cuáles son los horarios y formas de envío?",
];

/**
 * Botón flotante de WhatsApp (abajo a la derecha) que abre una ventanita tipo chat: el cliente elige
 * un tema o escribe su consulta y sigue la conversación en WhatsApp. Solo aparece si el local cargó
 * su número en el panel (Datos del local).
 */
export function WhatsappFloat({ whatsapp, storeName, hours }: { whatsapp: string; storeName: string; hours: string | null }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Abierta: foco en el mensaje; Escape o un clic afuera la cierran (y el foco vuelve al botón)
  useEffect(() => {
    if (!open) return;
    textRef.current?.focus();
    const close = (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) buttonRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(true);
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const text = message.trim() || `¡Hola ${storeName}! Tengo una consulta.`;

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-3 print:hidden sm:bottom-6 sm:right-6">
      {open && (
        <div
          ref={panelRef}
          id={`${id}-panel`}
          role="dialog"
          aria-labelledby={`${id}-title`}
          className="w-[min(22rem,calc(100vw-2rem))] origin-bottom-right overflow-hidden rounded-3xl bg-surface text-foreground shadow-2xl ring-1 ring-black/5 motion-safe:animate-[wa-pop_180ms_ease-out]"
        >
          <header className={`flex items-center gap-3 px-5 py-4 text-white ${GREEN_BG}`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15" aria-hidden>
              <ChatIcon size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`${id}-title`} className="truncate font-bold leading-tight">{storeName}</h2>
              <p className="truncate text-xs text-white/85">{hours ?? "Te respondemos por WhatsApp"}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              aria-label="Cerrar la ventana de WhatsApp"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-white/15"
            >
              <X size={18} weight="bold" aria-hidden />
            </button>
          </header>

          <div className="space-y-3 bg-background px-5 py-4">
            <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-surface px-4 py-2.5 text-sm shadow-sm">
              ¡Hola! 👋 ¿En qué te podemos ayudar?
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Temas frecuentes">
              {TOPICS.map((topic) => (
                <li key={topic}>
                  <button
                    type="button"
                    aria-pressed={message === topic}
                    onClick={() => {
                      setMessage(topic);
                      textRef.current?.focus();
                    }}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition-colors ${
                      message === topic
                        ? "border-primary bg-primary text-white"
                        : "border-border-strong bg-surface hover:border-primary hover:bg-primary-soft"
                    }`}
                  >
                    {topic}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              window.open(whatsappLink(whatsapp, text), "_blank", "noopener,noreferrer");
              setOpen(false);
              setMessage("");
            }}
          >
            <label htmlFor={`${id}-message`} className="sr-only">Tu mensaje</label>
            <textarea
              ref={textRef}
              id={`${id}-message`}
              rows={2}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                // Enter envía; Shift+Enter hace un salto de línea
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Escribí tu consulta…"
              className="min-h-11 flex-1 resize-none rounded-2xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              aria-label="Seguir en WhatsApp"
              title="Seguir en WhatsApp"
              className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-white transition-colors ${GREEN}`}
            >
              <PaperPlaneRight size={20} weight="fill" aria-hidden />
            </button>
          </form>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        aria-label={open ? "Cerrar la ventana de WhatsApp" : "Escribinos por WhatsApp"}
        title={open ? undefined : "Escribinos por WhatsApp"}
        className={`grid size-14 cursor-pointer place-items-center rounded-full text-white shadow-lg ring-4 ring-white/70 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-primary/50 ${GREEN}`}
      >
        {open ? <X size={26} weight="bold" aria-hidden /> : <ChatIcon size={30} />}
      </button>
    </div>
  );
}
