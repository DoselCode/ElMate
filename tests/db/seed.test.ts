import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

it("el seed carga sobre el modelo y deja el stock coherente con los movimientos", async () => {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.includes("storage")).sort()) {
    await db.exec(readFileSync(path.join(dir, f), "utf8"));
  }
  await db.exec(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));

  const products = await db.query<{ n: number }>("select count(*)::int as n from public.products");
  const variants = await db.query<{ n: number }>("select count(*)::int as n from public.product_variants");
  expect(products.rows[0].n).toBe(2);
  expect(variants.rows[0].n).toBe(5);

  // la caché de stock coincide con la suma de movimientos para toda variante
  const drift = await db.query(`
    select pv.sku from public.product_variants pv
    left join (select variant_id, sum(quantity) q from public.stock_movements group by 1) m on m.variant_id = pv.id
    where pv.stock <> coalesce(m.q, 0)`);
  expect(drift.rows).toEqual([]);

  const low = await db.query<{ sku: string }>("select sku from public.product_variants where low_stock order by sku");
  expect(low.rows.map((r) => r.sku)).toEqual(["MATE-IMP-MAR-G", "TERMO-1L-NEG"]);
  await db.close();
});
