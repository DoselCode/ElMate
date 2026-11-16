import { beforeEach, describe, expect, it } from "vitest";
import { ipFrom, rateLimit, resetRateLimits } from "./rate-limit";

beforeEach(resetRateLimits);

describe("rateLimit", () => {
  it("deja pasar hasta el límite y bloquea después", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("a", 3, 60_000, 1000).ok).toBe(true);
    const blocked = rateLimit("a", 3, 60_000, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(60);
  });

  it("cada clave tiene su propio contador", () => {
    rateLimit("a", 1, 60_000, 1000);
    expect(rateLimit("a", 1, 60_000, 1000).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000, 1000).ok).toBe(true);
  });

  it("al terminar la ventana se libera", () => {
    rateLimit("a", 1, 60_000, 1000);
    expect(rateLimit("a", 1, 60_000, 1000).ok).toBe(false);
    expect(rateLimit("a", 1, 60_000, 61_001).ok).toBe(true);
  });
});

describe("ipFrom", () => {
  const h = (v: Record<string, string>) => ({ get: (n: string) => v[n] ?? null });
  it("toma la primera IP de X-Forwarded-For", () => {
    expect(ipFrom(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
  it("sin cabeceras devuelve un valor fijo", () => {
    expect(ipFrom(h({}))).toBe("desconocida");
  });
});
