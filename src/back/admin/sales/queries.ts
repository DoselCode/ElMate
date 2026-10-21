import "server-only";
import { guarded } from "@/back/admin/auth/guarded";
import { requireAdmin, requireStaff } from "@/back/admin/auth/session";
import { PAGE_SIZE, pageParam, param, type SearchParams } from "@/shared/query";
import type {
  CashMethodTotal,
  CashMovementRow,
  CashState,
  CashSummary,
  ClosedSessionRow,
  IncomeMonth,
  Paged,
  SaleDetail,
  SaleItemRow,
  SaleRow,
  SalesFilters,
  SalesTotals,
  SellableItem,
  TicketStore,
  Unit,
} from "@/shared/types";

/**
 * Lecturas de caja, ventas e ingresos. Las fechas se manejan en hora argentina (UTC−3, sin horario
 * de verano): un día "2026-10-18" va de 00:00 a 23:59 de Buenos Aires.
 */

const AR_OFFSET = "-03:00";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fecha de hoy en Buenos Aires, YYYY-MM-DD. */
export function todayAR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** numeric llega como número desde PostgREST, pero se normaliza por las dudas (y los null quedan null). */
function numbers<T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): T {
  const out = { ...row };
  for (const k of keys) if (out[k] !== null && out[k] !== undefined) out[k] = Number(out[k]) as T[keyof T];
  return out;
}

const SUMMARY_NUMBERS: (keyof CashSummary)[] = [
  "opening_cash", "cash_sales", "other_sales", "sales_total", "cash_in", "cash_out", "expected_cash",
];

// ---- Caja ----------------------------------------------------------------------------------

/** Estado de la caja principal: si está abierta, sus totales, ventas por forma de pago y movimientos. */
export async function getCashState(): Promise<CashState> {
  return guarded(requireStaff, async (supabase) => {
    const { data: register } = await supabase
      .from("registers").select("id").eq("active", true).order("name").limit(1).maybeSingle();
    if (!register) return { registerId: null, open: null, suggestedOpening: 0 };

    const [openRes, lastClosedRes] = await Promise.all([
      supabase.from("cash_session_summary").select("*").eq("register_id", register.id).eq("status", "abierta").maybeSingle(),
      supabase
        .from("cash_sessions").select("cash_left").eq("register_id", register.id).eq("status", "cerrada")
        .order("closed_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const suggestedOpening = Number(lastClosedRes.data?.cash_left ?? 0);
    if (!openRes.data) return { registerId: register.id, open: null, suggestedOpening };

    const summary = numbers(openRes.data as CashSummary, SUMMARY_NUMBERS);
    const [byMethodRes, movementsRes] = await Promise.all([
      supabase.from("cash_session_by_method").select("payment_method_name, payment_is_cash, sales_count, total")
        .eq("session_id", summary.session_id).order("total", { ascending: false }),
      supabase.from("cash_movements").select("id, type, amount, reason, created_at, profiles(full_name)")
        .eq("session_id", summary.session_id).order("created_at"),
    ]);

    const byMethod = ((byMethodRes.data ?? []) as CashMethodTotal[]).map((m) => numbers(m, ["total"]));
    const movements: CashMovementRow[] = (movementsRes.data ?? []).map((m) => ({
      id: m.id,
      type: m.type,
      amount: Number(m.amount),
      reason: m.reason,
      created_at: m.created_at,
      created_by_name: nameOf(m.profiles),
    }));
    return { registerId: register.id, open: { summary, byMethod, movements }, suggestedOpening };
  });
}

/** Últimas cajas cerradas con su arqueo. */
export async function getClosedSessions(limit = 15): Promise<ClosedSessionRow[]> {
  return guarded(requireStaff, async (supabase) => {
    const { data: sessions } = await supabase
      .from("cash_sessions")
      .select("id, opened_at, closed_at, opening_cash, expected_cash, counted_cash, difference, cash_left, notes, closer:profiles!cash_sessions_closed_by_fkey(full_name)")
      .eq("status", "cerrada")
      .order("closed_at", { ascending: false })
      .limit(limit);
    if (!sessions?.length) return [];

    const { data: sums } = await supabase
      .from("cash_session_summary").select("session_id, cash_sales, other_sales")
      .in("session_id", sessions.map((s) => s.id));
    const byId = new Map((sums ?? []).map((s) => [s.session_id, s]));

    return sessions.map((s) => ({
      id: s.id,
      opened_at: s.opened_at,
      closed_at: s.closed_at,
      opening_cash: Number(s.opening_cash),
      cash_sales: Number(byId.get(s.id)?.cash_sales ?? 0),
      other_sales: Number(byId.get(s.id)?.other_sales ?? 0),
      expected_cash: Number(s.expected_cash),
      counted_cash: Number(s.counted_cash),
      difference: Number(s.difference),
      cash_left: Number(s.cash_left),
      notes: s.notes,
      closed_by_name: nameOf(s.closer),
    }));
  });
}

/** Las relaciones embebidas llegan como objeto o lista según el cliente. */
function nameOf(embedded: unknown): string | null {
  const row = (Array.isArray(embedded) ? embedded[0] : embedded) as { full_name?: string } | null | undefined;
  return row?.full_name || null;
}

// ---- Venta ---------------------------------------------------------------------------------

/** Todo lo que se puede vender (variantes activas), para buscar al instante en la pantalla de venta. */
export async function getSellables(): Promise<SellableItem[]> {
  return guarded(requireStaff, async (supabase) => {
    const { data } = await supabase
      .from("stock_overview")
      .select("variant_id, product_name, variant_label, sku, barcode, brand, category_name, price, stock, unit, track_stock, image")
      .eq("active", true)
      .order("product_name")
      .order("variant_label")
      .range(0, 4999);
    return ((data ?? []) as SellableItem[]).map((r) => numbers(r, ["price", "stock"]));
  });
}

// ---- Historial de ventas -------------------------------------------------------------------

export function parseSalesFilters(sp: SearchParams): SalesFilters {
  const status = param(sp, "status");
  const today = todayAR();
  const from = param(sp, "from");
  const to = param(sp, "to");
  return {
    from: DATE.test(from) ? from : today,
    to: DATE.test(to) ? to : DATE.test(from) ? from : today,
    method: param(sp, "method").slice(0, 40),
    status: status === "pagada" || status === "anulada" ? status : "",
    page: pageParam(sp),
  };
}

const SALE_NUMBERS: (keyof SaleRow)[] = ["subtotal", "discount_amount", "discount_pct", "adjustment_pct", "adjustment_amount", "total"];

/** Ventas del período, paginadas, más los totales del período (solo pagadas). */
export async function getSales(f: SalesFilters): Promise<Paged<SaleRow> & { totals: SalesTotals }> {
  return guarded(requireStaff, async (supabase) => {
    const range = { from: `${f.from}T00:00:00${AR_OFFSET}`, to: `${f.to}T23:59:59.999${AR_OFFSET}` };
    const from = (f.page - 1) * PAGE_SIZE;

    let list = supabase.from("sales_log").select("*", { count: "exact" })
      .gte("created_at", range.from).lte("created_at", range.to);
    if (f.method) list = list.eq("payment_method_name", f.method);
    if (f.status) list = list.eq("status", f.status);

    let paid = supabase.from("sales").select("total, payment_method_name")
      .eq("status", "pagada").gte("created_at", range.from).lte("created_at", range.to);
    if (f.method) paid = paid.eq("payment_method_name", f.method);

    const [listRes, paidRes] = await Promise.all([
      list.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
      f.status === "anulada" ? Promise.resolve({ data: [] as { total: number; payment_method_name: string }[] }) : paid.range(0, 9999),
    ]);

    const byMethod = new Map<string, number>();
    let total = 0;
    for (const s of paidRes.data ?? []) {
      total += Number(s.total);
      byMethod.set(s.payment_method_name, (byMethod.get(s.payment_method_name) ?? 0) + Number(s.total));
    }

    return {
      rows: ((listRes.data ?? []) as SaleRow[]).map((r) => numbers(r, SALE_NUMBERS)),
      total: listRes.count ?? 0,
      error: Boolean(listRes.error),
      totals: {
        count: paidRes.data?.length ?? 0,
        total: Math.round(total * 100) / 100,
        byMethod: [...byMethod].map(([name, t]) => ({ name, total: Math.round(t * 100) / 100 })).sort((a, b) => b.total - a.total),
      },
    };
  });
}

/** Una venta con sus productos y los datos del local para el ticket. */
export async function getSaleDetail(id: string): Promise<SaleDetail | null> {
  if (!UUID.test(id)) {
    await requireStaff();
    return null;
  }
  return guarded(requireStaff, async (supabase) => {
    const [saleRes, itemsRes, storeRes] = await Promise.all([
      supabase.from("sales_log").select("*").eq("id", id).maybeSingle(),
      supabase.from("sale_items")
        .select("product_name, variant_label, sku, quantity, unit_price, discount_pct, discount_amount, line_total, product_variants(products(unit))")
        .eq("sale_id", id).order("product_name"),
      supabase.from("store_settings").select("name, address, phone, legal_name, cuit, tax_condition").eq("id", 1).maybeSingle(),
    ]);
    if (!saleRes.data) return null;

    const items: SaleItemRow[] = (itemsRes.data ?? []).map((i) => ({
      product_name: i.product_name,
      variant_label: i.variant_label,
      sku: i.sku,
      quantity: Number(i.quantity),
      unit: unitOf(i.product_variants),
      unit_price: Number(i.unit_price),
      discount_pct: i.discount_pct === null ? null : Number(i.discount_pct),
      discount_amount: Number(i.discount_amount),
      line_total: Number(i.line_total),
    }));
    const store: TicketStore = storeRes.data ?? { name: "El Mate", address: null, phone: null, legal_name: null, cuit: null, tax_condition: null };
    return { sale: numbers(saleRes.data as SaleRow, SALE_NUMBERS), items, store };
  });
}

function unitOf(embedded: unknown): Unit {
  const variant = (Array.isArray(embedded) ? embedded[0] : embedded) as { products?: unknown } | null | undefined;
  const product = (Array.isArray(variant?.products) ? variant.products[0] : variant?.products) as { unit?: Unit } | null | undefined;
  return product?.unit === "kg" ? "kg" : "unidad";
}

// ---- Ingresos (solo admin) -----------------------------------------------------------------

/** Ingresos de un año, mes por mes: ventas del sistema + totales importados del Excel. */
export async function getIncomeReport(year: number): Promise<{ months: IncomeMonth[]; years: number[] }> {
  return guarded(requireAdmin, async (supabase) => {
    const start = `${year}-01-01`;
    const end = `${year}-12-01`;
    const [incomeRes, profitRes, historyRes, yearsRes] = await Promise.all([
      supabase.from("income_by_month").select("month, payment_method_name, payment_is_cash, sales_count, total")
        .gte("month", start).lte("month", end),
      supabase.from("profit_by_month").select("month, cost").gte("month", start).lte("month", end),
      supabase.from("income_history").select("month, cash_amount, other_amount").gte("month", start).lte("month", end),
      supabase.from("income_history").select("month"),
    ]);

    const months: IncomeMonth[] = Array.from({ length: 12 }, (_, i) => ({
      month: `${year}-${String(i + 1).padStart(2, "0")}-01`,
      cash: 0, other: 0, total: 0, salesCount: 0, systemTotal: 0, cost: null, source: "sin datos", byMethod: [],
    }));
    const at = (month: string) => months[Number(month.slice(5, 7)) - 1];

    for (const r of incomeRes.data ?? []) {
      const m = at(r.month);
      const t = Number(r.total);
      if (r.payment_is_cash) m.cash += t; else m.other += t;
      m.salesCount += r.sales_count;
      m.systemTotal += t;
      m.byMethod.push({ name: r.payment_method_name, total: t });
      m.source = "sistema";
    }
    for (const r of profitRes.data ?? []) at(r.month).cost = r.cost === null ? null : Number(r.cost);
    for (const r of historyRes.data ?? []) {
      const m = at(r.month);
      m.cash += Number(r.cash_amount);
      m.other += Number(r.other_amount);
      m.source = m.source === "sistema" ? "ambos" : "historial";
    }
    for (const m of months) {
      m.total = Math.round((m.cash + m.other) * 100) / 100;
      m.byMethod.sort((a, b) => b.total - a.total);
    }

    const years = new Set<number>([new Date().getFullYear(), year]);
    for (const r of yearsRes.data ?? []) years.add(Number(r.month.slice(0, 4)));
    return { months, years: [...years].sort((a, b) => b - a) };
  });
}
