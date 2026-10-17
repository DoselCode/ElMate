import { cartTotal } from "./cart";
import { formatMoney } from "./format";
import type { CartItem } from "./types";

/**
 * Número para wa.me: solo dígitos, con código de país. Acepta como lo cargue el local:
 * "+54 9 11 5555-1234", "011 15 5555-1234", "1155551234"… Devuelve null si no parece válido.
 */
export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // 0054...
  if (digits.startsWith("54")) {
    // Celulares argentinos en WhatsApp: 54 9 + área + número (sin el 15)
    if (!digits.startsWith("549")) digits = `549${digits.slice(2)}`;
  } else {
    if (digits.startsWith("0")) digits = digits.slice(1); // 011... → 11...
    // área + 15 + número = 12 dígitos: el 15 local no va en WhatsApp
    if (digits.length === 12) digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
    if (digits.length === 10) digits = `549${digits}`;
  }
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

export function buildOrderMessage(
  items: CartItem[],
  { storeName, customerName, notes }: { storeName: string; customerName?: string; notes?: string },
): string {
  const lines = items.map((i) => {
    const label = i.variantLabel ? ` (${i.variantLabel})` : "";
    return `• ${i.quantity} × ${i.name}${label} — ${formatMoney(i.price * i.quantity)}`;
  });

  const parts = [
    `¡Hola ${storeName}! Quiero hacer este pedido:`,
    "",
    ...lines,
    "",
    `Total estimado: ${formatMoney(cartTotal(items))}`,
  ];
  if (customerName?.trim()) parts.push(`Nombre: ${customerName.trim()}`);
  if (notes?.trim()) parts.push(`Nota: ${notes.trim()}`);
  return parts.join("\n");
}

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
