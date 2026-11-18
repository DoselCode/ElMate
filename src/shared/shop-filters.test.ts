import { describe, expect, it } from "vitest";
import type { ShopFilters } from "./types";
import { activeFilterCount, offerableFacets, parseShopFilters, shopQuery, toggleValue } from "./shop-filters";
import { EMPTY_FACETS } from "./types";

const full: ShopFilters = {
  q: "mate",
  category: "yerbas",
  sort: "precio-asc",
  offers: true,
  promo: "dia-del-padre",
  page: 1,
  brands: ["waterdog", "el-mate"],
  price: { min: 5000, max: 20000 },
  options: { color: ["rojo", "negro"] },
  inStock: true,
};

const fromQuery = (query: string) => parseShopFilters(Object.fromEntries(new URLSearchParams(query)));

describe("parseShopFilters", () => {
  it("keeps legacy links", () => {
    const f = parseShopFilters({ categoria: "yerbas", ofertas: "1", orden: "precio-asc", promo: "dia-padre", q: "mate", page: "2" });
    expect(f).toEqual({
      q: "mate",
      category: "yerbas",
      sort: "precio-asc",
      offers: true,
      promo: "dia-padre",
      page: 2,
      brands: [],
      price: { min: null, max: null },
      options: {},
      inStock: false,
    });
  });

  it("parses multi values", () => {
    const f = parseShopFilters({ marca: "waterdog,el-mate", color: "rojo,negro", stock: "1", precio: "5000-20000" });
    expect(f.brands).toEqual(["waterdog", "el-mate"]);
    expect(f.options).toEqual({ color: ["rojo", "negro"] });
    expect(f.inStock).toBe(true);
    expect(f.price).toEqual({ min: 5000, max: 20000 });
  });

  it("drops invalid values", () => {
    expect(parseShopFilters({ marca: ",,Wáter Dog!,ok" }).brands).toEqual(["ok"]);
    expect(parseShopFilters({ precio: "abc" }).price).toEqual({ min: null, max: null });
    expect(parseShopFilters({ precio: "-20000" }).price).toEqual({ min: null, max: 20000 });
    expect(parseShopFilters({ precio: "5000-" }).price).toEqual({ min: 5000, max: null });
    expect(parseShopFilters({ precio: "900-100" }).price).toEqual({ min: 100, max: 900 });
    expect(parseShopFilters({ color: "<script>" }).options).toEqual({});
    const many = Array.from({ length: 25 }, (_, i) => `m${i}`).join(",");
    expect(parseShopFilters({ marca: many }).brands).toHaveLength(20);
  });

  it("ignores reserved and excess option params", () => {
    const f = parseShopFilters({ precio: "1-2", a: "x", b: "x", c: "x", d: "x", e: "x", g: "x", h: "x", "Mal Nombre": "x" });
    expect(Object.keys(f.options)).toHaveLength(5);
    expect(f.options).not.toHaveProperty("precio");
    expect(f.options).not.toHaveProperty("Mal Nombre");
  });
});

describe("shopQuery", () => {
  it("round trips", () => {
    expect(fromQuery(shopQuery(full))).toEqual(full);
  });

  it("omits defaults", () => {
    expect(shopQuery(parseShopFilters({}))).toBe("");
  });

  it("patch resets page", () => {
    const query = shopQuery({ ...full, page: 3 }, { brands: ["x"] });
    expect(query).not.toContain("page=");
    expect(fromQuery(query).brands).toEqual(["x"]);
  });

  it("keeps page when asked explicitly", () => {
    expect(fromQuery(shopQuery(full, { page: 4 })).page).toBe(4);
  });
});

describe("helpers", () => {
  it("toggleValue adds and removes", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });

  it("activeFilterCount counts every selected value", () => {
    const f = parseShopFilters({ categoria: "yerbas", marca: "a,b", precio: "1-", promo: "x" });
    expect(activeFilterCount(f)).toBe(5);
    expect(activeFilterCount(full)).toBe(9);
  });
});

describe("offerableFacets", () => {
  it("drops options whose key clashes with a reserved param", () => {
    const values = [{ value: "Rojo", key: "rojo", count: 1 }];
    const f = offerableFacets({
      ...EMPTY_FACETS,
      options: [
        { name: "Precio", key: "precio", values },
        { name: "Color", key: "color", values },
      ],
    });
    expect(f.options.map((o) => o.key)).toEqual(["color"]);
  });
});
