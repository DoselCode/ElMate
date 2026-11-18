"use client";

import { useRef, useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { inputClass, inputErrorClass } from "./field";

/** "2026-11-18" → "18-11-2026". */
export function isoToDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** "18-11-2026" → "2026-11-18", o "" si no es una fecha que exista. */
export function dmyToIso(dmy: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dmy);
  if (!m) return "";
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const ok = date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(mo) - 1 && date.getUTCDate() === Number(d);
  return ok ? `${y}-${mo}-${d}` : "";
}

/** Mientras se tipea: solo números, con los guiones puestos solos (18-11-2026). */
function mask(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

/**
 * Fecha en formato dd-mm-aaaa, igual en cualquier navegador (el <input type="date"> nativo muestra el
 * formato del idioma del sistema, a veces mm/dd/aaaa). Se tipea con los guiones automáticos o se elige
 * del calendario con el botón. `value` y `onChange` usan aaaa-mm-dd, como la URL y la base; mientras la
 * fecha está incompleta o no existe, `onChange` recibe "".
 */
export function DateInput({
  id,
  value,
  max,
  onChange,
  className = "",
}: {
  id: string;
  value: string;
  max?: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => isoToDmy(value));
  const [seen, setSeen] = useState(value);

  // Si la fecha cambia desde afuera (ej: "Ver hoy" o la otra fecha del rango), el texto la sigue
  if (seen !== value) {
    setSeen(value);
    if (value) setText(isoToDmy(value));
  }

  const iso = dmyToIso(text);
  const invalid = text.length === 10 && (!iso || (max !== undefined && iso > max));

  function type(next: string) {
    const masked = mask(next);
    setText(masked);
    const parsed = dmyToIso(masked);
    onChange(parsed && (max === undefined || parsed <= max) ? parsed : "");
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd-mm-aaaa"
        maxLength={10}
        value={text}
        aria-invalid={invalid}
        onChange={(e) => type(e.target.value)}
        className={`${inputClass} w-40 pr-11 tabular-nums ${invalid ? inputErrorClass : ""}`}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label="Elegir la fecha en el calendario"
        title="Elegir en el calendario"
        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-primary"
      >
        <CalendarBlank size={18} aria-hidden />
      </button>
      {/* Calendario nativo, invisible: solo se abre con el botón */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={iso || value}
        max={max}
        onChange={(e) => {
          setText(isoToDmy(e.target.value));
          onChange(e.target.value);
        }}
        className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      />
    </div>
  );
}
