import type { NextRequest } from "next/server";
import { searchProducts } from "@/back/landing/catalog";
import { ipFrom, rateLimit } from "@/shared/rate-limit";

/** GET /api/buscar?q=… → resultados del buscador del header (solo datos públicos del catálogo). */
export async function GET(request: NextRequest) {
  // 60 búsquedas por minuto por IP: de sobra para escribir en el buscador, frena el barrido automático
  const limit = rateLimit(`buscar:${ipFrom(request.headers)}`, 60, 60_000);
  if (!limit.ok) {
    return Response.json({ rows: [], total: 0 }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const result = await searchProducts(request.nextUrl.searchParams.get("q") ?? "");
  // Lo mismo que la web pública: puede cachearse un minuto
  return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
