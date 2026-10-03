type PgError = { message?: string; code?: string; details?: string | null };

/**
 * Traduce errores de Postgres/PostgREST a mensajes para el usuario.
 * Los `raise exception` de nuestras funciones SQL (código P0001) ya vienen en español y se muestran tal cual.
 */
export function friendlyDbError(error: PgError): string {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;

  if (error.code === "42501") return "No tenés permisos para hacer esto.";
  if (error.code === "P0001" && error.message) return error.message;

  if (error.code === "23505") {
    if (text.includes("product_variants_sku_key")) return "Ya existe una variante con ese código (SKU).";
    if (text.includes("product_variants_barcode_key")) return "Ya existe una variante con ese código de barras.";
    if (text.includes("product_variants_product_id_attributes_key")) return "Hay dos variantes con la misma combinación de opciones.";
    if (text.includes("products_slug_key")) return "Ya existe un producto con ese nombre. Probá con otro.";
    return "Ya existe un registro con esos datos.";
  }
  if (error.code === "23514") return "Algún valor está fuera del rango permitido.";
  if (error.code === "22P02" || error.code === "22003") return "Algún valor numérico es inválido.";

  console.error("Error de base de datos", error);
  return "No se pudo completar la operación. Probá de nuevo.";
}
