/**
 * Precios como la lista del local (Excel "LISTA PRODUCTOS SOFTWARE"):
 *
 *   precio en efectivo = costo ÷ (1 − ganancia), redondeado a $10
 *   precio de lista    = precio en efectivo ÷ (1 + ajuste del efectivo)   (efectivo −20 % → ÷ 0,8)
 *
 * El precio de lista es el que se guarda en la variante; cada forma de pago aplica su ajuste
 * sobre la lista al vender (efectivo −20 %, débito/transferencia −15 %, 3 cuotas −10 %…).
 */

/** Redondeo del precio en efectivo, como la lista del local. */
export const CASH_ROUNDING = 10;

const cents = (n: number) => Math.round(n * 100) / 100;

/** Precio de lista con un ajuste aplicado (−20 → 20 % menos). */
export function applyAdjustment(listPrice: number, adjustmentPct: number): number {
  return cents(listPrice * (1 + adjustmentPct / 100));
}

/**
 * Precio en efectivo y de lista a partir de costo y % de ganancia.
 * `cashAdjustmentPct` es el ajuste de la forma de pago en efectivo (normalmente −20).
 * Devuelve null si los datos no alcanzan para calcular (sin costo o ganancia fuera de rango).
 */
export function priceFromCost(
  cost: number,
  marginPct: number,
  cashAdjustmentPct: number,
): { cashPrice: number; listPrice: number } | null {
  if (!(cost > 0) || !(marginPct >= 0 && marginPct < 100) || !(cashAdjustmentPct > -100)) return null;
  const cashPrice = Math.round(cost / (1 - marginPct / 100) / CASH_ROUNDING) * CASH_ROUNDING;
  const listPrice = cents(cashPrice / (1 + cashAdjustmentPct / 100));
  return { cashPrice, listPrice };
}

/** % de ganancia real de un precio de lista dado (para mostrar cuando el precio se pisa a mano). */
export function marginOf(listPrice: number, cost: number, cashAdjustmentPct: number): number | null {
  const cash = applyAdjustment(listPrice, cashAdjustmentPct);
  if (!(cash > 0) || !(cost >= 0)) return null;
  return Math.round((1 - cost / cash) * 1000) / 10;
}
