import type { NextRequest } from "next/server";
import { searchProducts } from "@/back/landing/catalog";

/** GET /api/buscar?q=… → resultados del buscador del header (solo datos públicos del catálogo). */
export async function GET(request: NextRequest) {
  const result = await searchProducts(request.nextUrl.searchParams.get("q") ?? "");
  // Lo mismo que la web pública: puede cachearse un minuto
  return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
