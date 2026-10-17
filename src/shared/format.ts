const TIME_ZONE = "America/Argentina/Buenos_Aires";

const amount = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amountRound = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  // 24 h ("18:30"): sin "a. m./p. m.", que Node y cada navegador escriben con espacios distintos
  hourCycle: "h23",
});

/** $12.500 si es entero, $12.500,50 si tiene centavos (sin espacio después del $, como en el diseño). */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = Number.isInteger(n) ? amountRound.format(Math.abs(n)) : amount.format(Math.abs(n));
  return `${n < 0 ? "−" : ""}$${digits}`;
}

/** 18/10/2026, 18:30 (hora argentina). Igual en el servidor y en el navegador (evita errores de hidratación). */
export function formatDateTime(value: string | Date): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value).replace(/[\u202f\u00a0]/g, " ");
}


import type { Unit } from "./types";

export type { Unit };

const qty = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

/** Cantidad con su unidad: "3" (unidades) o "0,25 kg". Con `signed`: "+5" / "−0,5 kg". */
export function formatQuantity(value: number | string, unit: Unit = "unidad", opts: { signed?: boolean } = {}): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = opts.signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : n < 0 ? "−" : "";
  return `${sign}${qty.format(Math.abs(n))}${unit === "kg" ? " kg" : ""}`;
}

/** Número escrito a mano, con coma o punto decimal ("0,25" → 0.25). NaN si no es un número. */
export function parseDecimal(text: string): number {
  const clean = text.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return NaN;
  return Number(clean);
}
