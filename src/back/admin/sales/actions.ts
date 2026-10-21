"use server";

import { revalidatePath } from "next/cache";
import { getAdminOrNull, getCurrentUser } from "@/back/admin/auth/session";
import { friendlyDbError } from "@/back/shared/db-errors";
import { createClient } from "@/back/shared/supabase/server";
import { fieldErrors } from "@/shared/schemas/product";
import { cashMovementSchema, closeCashSchema, openCashSchema, saleSchema, voidSaleSchema } from "@/shared/schemas/sales";
import type { ActionResult } from "@/shared/types";

/**
 * Escrituras de caja y ventas. Vender y manejar la caja lo puede hacer cualquier empleado;
 * anular ventas, solo el admin. Cada operación es una función SQL transaccional en la base.
 */

const NOT_STAFF = { ok: false, error: "Tu sesión expiró. Volvé a ingresar." } as const;
const INVALID = { ok: false, error: "Revisá los datos ingresados." } as const;
const NO_CASH = { ok: false, error: "La caja está cerrada. Abrila para continuar." } as const;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function mainRegisterId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.from("registers").select("id").eq("active", true).order("name").limit(1).maybeSingle();
  return data?.id ?? null;
}

async function openSessionId(supabase: Supabase): Promise<string | null> {
  const registerId = await mainRegisterId(supabase);
  if (!registerId) return null;
  const { data } = await supabase
    .from("cash_sessions").select("id").eq("register_id", registerId).eq("status", "abierta").maybeSingle();
  return data?.id ?? null;
}

/** La caja cambia los totales del panel; una venta además cambia el stock de la web. */
function refreshPanel() {
  revalidatePath("/admin", "layout");
}

export async function openCashAction(input: unknown): Promise<ActionResult> {
  if (!(await getCurrentUser())) return NOT_STAFF;
  const parsed = openCashSchema.safeParse(input);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const registerId = await mainRegisterId(supabase);
  if (!registerId) return { ok: false, error: "No hay una caja configurada." };

  const { error } = await supabase.rpc("open_cash_session", { p_register_id: registerId, p_opening_cash: parsed.data.openingCash });
  if (error) return { ok: false, error: friendlyDbError(error) };
  refreshPanel();
  return { ok: true };
}

export async function addCashMovementAction(input: unknown): Promise<ActionResult> {
  if (!(await getCurrentUser())) return NOT_STAFF;
  const parsed = cashMovementSchema.safeParse(input);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const sessionId = await openSessionId(supabase);
  if (!sessionId) return NO_CASH;

  const { type, amount, reason } = parsed.data;
  const { error } = await supabase.rpc("add_cash_movement", {
    p_session_id: sessionId, p_type: type, p_amount: amount, p_reason: reason,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };
  refreshPanel();
  return { ok: true };
}

export async function closeCashAction(input: unknown): Promise<ActionResult> {
  if (!(await getCurrentUser())) return NOT_STAFF;
  const parsed = closeCashSchema.safeParse(input);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const sessionId = await openSessionId(supabase);
  if (!sessionId) return NO_CASH;

  const { countedCash, cashLeft, notes } = parsed.data;
  const { error } = await supabase.rpc("close_cash_session", {
    p_session_id: sessionId, p_counted_cash: countedCash, p_cash_left: cashLeft, p_notes: notes || null,
  });
  if (error) return { ok: false, error: friendlyDbError(error) };
  refreshPanel();
  return { ok: true };
}

export async function createSaleAction(input: unknown): Promise<ActionResult<{ saleId: string; ticketNumber: number }>> {
  if (!(await getCurrentUser())) return NOT_STAFF;
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const sessionId = await openSessionId(supabase);
  if (!sessionId) return NO_CASH;

  const sale = parsed.data;
  const { data: saleId, error } = await supabase.rpc("create_sale", {
    p_session_id: sessionId,
    p_payment_method_id: sale.paymentMethodId,
    p_items: sale.items.map((i) => ({
      variant_id: i.variantId,
      quantity: i.quantity,
      ...(i.discount?.type === "pct" ? { discount_pct: i.discount.value } : {}),
      ...(i.discount?.type === "amount" ? { discount_amount: i.discount.value } : {}),
    })),
    p_discount: sale.discount.value,
    p_discount_is_pct: sale.discount.type === "pct",
    p_customer: sale.customer || null,
    p_notes: sale.notes || null,
  });
  if (error || !saleId) return { ok: false, error: error ? friendlyDbError(error) : "No se pudo registrar la venta." };

  const { data: row } = await supabase.from("sales").select("ticket_number").eq("id", saleId).single();
  // El stock cambió: se refresca el panel y la web (disponibilidad y más vendidos)
  revalidatePath("/", "layout");
  return { ok: true, saleId: saleId as string, ticketNumber: Number(row?.ticket_number ?? 0) };
}

export async function voidSaleAction(input: unknown): Promise<ActionResult> {
  if (!(await getAdminOrNull())) return { ok: false, error: "Solo un administrador puede anular ventas." };
  const parsed = voidSaleSchema.safeParse(input);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: parsed.data.saleId, p_reason: parsed.data.reason });
  if (error) return { ok: false, error: friendlyDbError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
