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
});

/** $12.500 si es entero, $12.500,50 si tiene centavos (sin espacio después del $, como en el diseño). */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = Number.isInteger(n) ? amountRound.format(Math.abs(n)) : amount.format(Math.abs(n));
  return `${n < 0 ? "−" : ""}$${digits}`;
}

export function formatDateTime(value: string | Date): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value);
}

/** Cantidad con signo explícito: +5 / −3. */
export function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}
