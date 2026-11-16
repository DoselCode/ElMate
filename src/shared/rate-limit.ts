/**
 * Límite de intentos en memoria (ventana fija) para frenar fuerza bruta en el login y abuso del buscador público.
 * La app corre en un único proceso (un contenedor), así que alcanza; si algún día se escala a varias
 * instancias hay que mover el contador a un almacén compartido.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/**
 * Cuenta un intento sobre `key`. ok=false cuando se superó `limit` dentro de la ventana de `windowMs`;
 * retryAfter son los segundos que faltan para que se libere.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  // Sin esto el mapa crecería sin tope si alguien prueba claves distintas
  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** IP del cliente según el proxy (Coolify/Traefik pone la real en X-Forwarded-For). */
export function ipFrom(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || headers.get("x-real-ip") || "desconocida").slice(0, 64);
}

/** Solo para tests. */
export function resetRateLimits() {
  buckets.clear();
}
