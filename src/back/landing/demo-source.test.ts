import { describe, expect, it } from "vitest";
import { demoSource } from "./demo-source";

const all = { sort: "destacados" as const, limit: 100 };

describe("demo catalog facets", () => {
  it("demo has brands and colors", async () => {
    const f = await demoSource.facets({});
    expect(f.brands.length).toBeGreaterThanOrEqual(2);
    const color = f.options.find((o) => o.key === "color");
    expect(color?.name).toBe("Color");
    expect(color?.values.length).toBeGreaterThanOrEqual(2);
  });

  it("facets are disjunctive", async () => {
    const before = await demoSource.facets({});
    const brand = before.brands[0].key;
    const after = await demoSource.facets({ brands: [brand] });
    expect(after.brands).toEqual(before.brands);
    const { total } = await demoSource.products({ ...all, brands: [brand] });
    expect(after.categories.reduce((n, c) => n + c.count, 0)).toBe(total);
  });

  it("no zero counts", async () => {
    const f = await demoSource.facets({ category: "mates" });
    for (const list of [f.brands, f.categories, ...f.options.map((o) => o.values)]) {
      for (const item of list) expect(item.count).toBeGreaterThan(0);
    }
  });

  it("products filter by option and stock", async () => {
    const { rows } = await demoSource.products({ ...all, options: { color: ["verde"] }, inStock: true });
    expect(rows).toEqual([]);
    const any = await demoSource.products({ ...all, options: { color: ["verde"] } });
    expect(any.rows.length).toBe(1);
    const negro = await demoSource.products({ ...all, options: { color: ["negro"] }, inStock: true });
    for (const p of negro.rows) expect(p.option_tags_in_stock).toContain("color:negro");
  });

  it("price filter uses card price", async () => {
    const { rows, total } = await demoSource.products({ ...all, priceMin: 20000, priceMax: 80000 });
    expect(total).toBeGreaterThan(0);
    for (const p of rows) {
      expect(p.price).toBeGreaterThanOrEqual(20000);
      expect(p.price).toBeLessThanOrEqual(80000);
    }
  });

  it("price range ignores its own filter", async () => {
    expect((await demoSource.facets({ priceMin: 20000 })).price).toEqual((await demoSource.facets({})).price);
  });
});
