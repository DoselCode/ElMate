import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const migrationsDir = path.join(root, "supabase/migrations");

let db: PGlite;
let adminId: string;
let staffId: string;
let registerId: string;

// Filas de pruebas: se leen campos sueltos, no vale la pena tipar cada consulta
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Ejecuta fn con el rol y el usuario de la API (como lo haría PostgREST). */
async function as<T>(user: "anon" | string, fn: () => Promise<T>): Promise<T> {
  if (user === "anon") {
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  } else {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  }
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function rows(sql: string, params: unknown[] = []): Promise<Row[]> {
  return (await db.query<Row>(sql, params)).rows;
}

async function saveProduct(user: string, product: Row): Promise<string> {
  const [r] = await as(user, () => rows("select public.save_product($1::jsonb) as id", [JSON.stringify(product)]));
  return r.id;
}

const mate = {
  name: "Mate Imperial",
  slug: "mate-imperial",
  description: "Calabaza forrada en cuero",
  option_names: ["Color", "Tamaño"],
  variants: [
    { sku: "mate-neg-g", attributes: { Color: "Negro", Tamaño: "Grande" }, price: 10000, cost: 6000, min_stock: 2, initial_stock: 5 },
    { sku: "mate-mar-c", attributes: { Color: "Marrón", Tamaño: "Chico" }, price: 8000, cost: 5000, min_stock: 1, initial_stock: 3 },
  ],
};

async function variantBySku(sku: string): Promise<Row> {
  const [v] = await rows("select * from public.product_variants where sku = $1", [sku]);
  return v;
}

async function openCash(user: string, opening = 1000): Promise<string> {
  const [r] = await as(user, () => rows("select public.open_cash_session($1, $2) as id", [registerId, opening]));
  return r.id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql") && !f.includes("storage")).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  const [a] = await rows("insert into auth.users (email) values ('admin@elmate.test') returning id");
  const [s] = await rows("insert into auth.users (email) values ('caja@elmate.test') returning id");
  adminId = a.id;
  staffId = s.id;
  registerId = (await rows("select id from public.registers limit 1"))[0].id;
});

afterAll(async () => {
  await db.close();
});

describe("usuarios y roles", () => {
  it("el primer usuario es admin y el siguiente empleado", async () => {
    const profiles = await rows("select id, role from public.profiles order by created_at");
    expect(profiles.find((p) => p.id === adminId)?.role).toBe("admin");
    expect(profiles.find((p) => p.id === staffId)?.role).toBe("empleado");
  });

  it("un empleado no puede ascenderse a admin", async () => {
    await as(staffId, () => db.query("update public.profiles set role = 'admin' where id = $1", [staffId]));
    const [p] = await rows("select role from public.profiles where id = $1", [staffId]);
    expect(p.role).toBe("empleado"); // RLS filtra la fila: 0 filas actualizadas, sin error
  });

  it("un usuario inactivo pierde el acceso", async () => {
    const [u] = await rows("insert into auth.users (email) values ('baja@elmate.test') returning id");
    await rows("update public.profiles set active = false where id = $1", [u.id]);
    const visible = await as(u.id, () => rows("select id from public.products"));
    expect(visible).toHaveLength(0);
    await expect(as(u.id, () => rows("select public.open_cash_session($1, 0)", [registerId]))).rejects.toThrow(/Permiso denegado/);
  });
});

describe("catálogo y stock", () => {
  let productId: string;

  it("el admin crea un producto con variantes, costo y stock inicial", async () => {
    productId = await saveProduct(adminId, mate);
    const v = await variantBySku("MATE-NEG-G");
    expect(v.stock).toBe(5);
    expect(Number(v.price)).toBe(10000);

    const moves = await rows("select type, quantity, stock_after, reason from public.stock_movements where variant_id = $1", [v.id]);
    expect(moves).toEqual([{ type: "ingreso", quantity: 5, stock_after: 5, reason: "Stock inicial" }]);

    const costs = await as(adminId, () => rows("select cost from public.variant_costs where variant_id = $1", [v.id]));
    expect(Number(costs[0].cost)).toBe(6000);
  });

  it("el empleado ve el catálogo pero no los costos", async () => {
    const variants = await as(staffId, () => rows("select sku from public.product_variants"));
    expect(variants).toHaveLength(2);
    expect(await as(staffId, () => rows("select * from public.variant_costs"))).toHaveLength(0);
    expect(await as(staffId, () => rows("select * from public.sale_item_costs"))).toHaveLength(0);
  });

  it("el empleado no puede crear productos ni tocar el stock", async () => {
    await expect(saveProduct(staffId, { ...mate, slug: "otro" })).rejects.toThrow(/Permiso denegado/);
    const v = await variantBySku("MATE-NEG-G");
    await expect(as(staffId, () => rows("select public.adjust_stock($1, 10, 'x')", [v.id]))).rejects.toThrow(/Permiso denegado/);
    await expect(as(staffId, () => rows("select public.register_stock_in($1, 10)", [v.id]))).rejects.toThrow(/Permiso denegado/);
    await expect(as(staffId, () => db.query("update public.product_variants set stock = 999 where id = $1", [v.id]))).rejects.toThrow(/permission denied/);
    await expect(as(adminId, () => db.query("update public.product_variants set stock = 999 where id = $1", [v.id]))).rejects.toThrow(/permission denied/);
    await expect(as(adminId, () => db.query("insert into public.stock_movements (variant_id, type, quantity) values ($1, 'ingreso', 1)", [v.id]))).rejects.toThrow(/permission denied/);
    expect((await variantBySku("MATE-NEG-G")).stock).toBe(5);
  });

  it("el ingreso suma stock y actualiza el costo; el ajuste exige motivo", async () => {
    const v = await variantBySku("MATE-NEG-G");
    await as(adminId, () => rows("select public.register_stock_in($1, 10, 6500, 'Compra proveedor')", [v.id]));
    expect((await variantBySku("MATE-NEG-G")).stock).toBe(15);
    const [c] = await as(adminId, () => rows("select cost from public.variant_costs where variant_id = $1", [v.id]));
    expect(Number(c.cost)).toBe(6500);

    await expect(as(adminId, () => rows("select public.adjust_stock($1, -1, '  ')", [v.id]))).rejects.toThrow();
    await as(adminId, () => rows("select public.adjust_stock($1, -2, 'Rotura')", [v.id]));
    expect((await variantBySku("MATE-NEG-G")).stock).toBe(13);
  });

  it("no deja el stock en negativo", async () => {
    const v = await variantBySku("MATE-MAR-C");
    await expect(as(adminId, () => rows("select public.adjust_stock($1, -50, 'Error')", [v.id]))).rejects.toThrow(/Stock insuficiente/);
    expect((await variantBySku("MATE-MAR-C")).stock).toBe(3);
  });

  it("los movimientos son inmutables", async () => {
    await expect(db.query("update public.stock_movements set quantity = 1 where id = (select min(id) from public.stock_movements)")).rejects.toThrow(/no se pueden modificar/);
    await expect(db.query("delete from public.stock_movements")).rejects.toThrow(/no se pueden modificar/);
  });

  it("marca bajo stock según el mínimo", async () => {
    const v = await variantBySku("MATE-MAR-C"); // stock 3, mínimo 1
    expect(v.low_stock).toBe(false);
    await as(adminId, () => rows("select public.adjust_stock($1, -2, 'Conteo')", [v.id]));
    expect((await variantBySku("MATE-MAR-C")).low_stock).toBe(true);
    await as(adminId, () => rows("select public.adjust_stock($1, 2, 'Conteo')", [v.id]));
  });

  it("editar el producto desactiva las variantes que ya no vienen y no pisa el stock", async () => {
    const neg = await variantBySku("MATE-NEG-G");
    const edited = {
      ...mate,
      id: productId,
      variants: [{ id: neg.id, sku: "mate-neg-g", attributes: { Color: "Negro", Tamaño: "Grande" }, price: 11000, min_stock: 2 }],
    };
    await saveProduct(adminId, edited);
    const after = await variantBySku("MATE-NEG-G");
    expect(Number(after.price)).toBe(11000);
    expect(after.stock).toBe(13);
    expect((await variantBySku("MATE-MAR-C")).active).toBe(false);
    // el costo no se tocó porque no vino en el payload
    const [c] = await as(adminId, () => rows("select cost from public.variant_costs where variant_id = $1", [neg.id]));
    expect(Number(c.cost)).toBe(6500);
  });

  it("rechaza SKU duplicado y variantes repetidas", async () => {
    await expect(saveProduct(adminId, { ...mate, slug: "copia" })).rejects.toThrow(/duplicate key|unique/i);
    await expect(
      saveProduct(adminId, {
        name: "Bombilla", slug: "bombilla", option_names: ["Material"],
        variants: [
          { sku: "bomb-1", attributes: { Material: "Acero" }, price: 1 },
          { sku: "bomb-2", attributes: { Material: "Acero" }, price: 1 },
        ],
      }),
    ).rejects.toThrow(/duplicate key|unique/i);
    expect(await rows("select 1 from public.products where slug = 'bombilla'")).toHaveLength(0); // rollback completo
  });

  it("solo puede haber un producto destacado", async () => {
    const other = await saveProduct(adminId, {
      name: "Termo Stanley", slug: "termo-stanley", variants: [{ sku: "termo-1", price: 50000, initial_stock: 4 }],
    });
    await as(adminId, () => rows("select public.set_featured_product($1)", [productId]));
    await as(adminId, () => rows("select public.set_featured_product($1)", [other]));
    const featured = await rows("select slug from public.products where is_featured");
    expect(featured).toEqual([{ slug: "termo-stanley" }]);
    await as(adminId, () => rows("select public.set_featured_product(null)"));
    expect(await rows("select 1 from public.products where is_featured")).toHaveLength(0);
  });
});

describe("web pública (anon)", () => {
  it("ve productos visibles sin costos ni stock exacto", async () => {
    const products = await as("anon", () => rows("select * from public.public_products order by name"));
    expect(products.map((p) => p.slug)).toContain("mate-imperial");
    expect(Object.keys(products[0])).not.toContain("stock");
    const variants = await as("anon", () => rows("select * from public.public_variants"));
    expect(Object.keys(variants[0])).not.toContain("stock");
    expect(Object.keys(variants[0])).not.toContain("cost");
    expect(variants.every((v) => typeof v.in_stock === "boolean")).toBe(true);
  });

  it("no ve productos ocultos", async () => {
    await rows("update public.products set is_visible = false where slug = 'termo-stanley'");
    const slugs = (await as("anon", () => rows("select slug from public.public_products"))).map((p) => p.slug);
    expect(slugs).not.toContain("termo-stanley");
    await rows("update public.products set is_visible = true where slug = 'termo-stanley'");
  });

  it("no accede a las tablas ni puede escribir a través de las vistas", async () => {
    await expect(as("anon", () => rows("select * from public.product_variants"))).rejects.toThrow(/permission denied/);
    await expect(as("anon", () => rows("select * from public.variant_costs"))).rejects.toThrow(/permission denied/);
    await expect(as("anon", () => rows("select * from public.sales"))).rejects.toThrow(/permission denied/);
    await expect(as("anon", () => rows("insert into public.public_categories (name, slug) values ('Hack', 'hack')"))).rejects.toThrow(/permission denied/);
    await expect(as("anon", () => rows("select public.create_sale(gen_random_uuid(), 'efectivo', '[]')"))).rejects.toThrow(/permission denied/);
  });
});

describe("caja y ventas", () => {
  let sessionId: string;
  let negId: string;

  it("abre la caja y no permite una segunda abierta", async () => {
    sessionId = await openCash(staffId, 1000);
    await expect(openCash(adminId)).rejects.toThrow(/ya está abierta/);
  });

  it("vende con el precio de lista, descuenta stock y congela el costo", async () => {
    negId = (await variantBySku("MATE-NEG-G")).id; // stock 13, precio 11000, costo 6500
    const [r] = await as(staffId, () =>
      rows("select public.create_sale($1, 'efectivo', $2::jsonb) as id", [sessionId, JSON.stringify([{ variant_id: negId, quantity: 2 }])]),
    );
    const [sale] = await rows("select * from public.sales where id = $1", [r.id]);
    expect(Number(sale.subtotal)).toBe(22000);
    expect(Number(sale.total)).toBe(22000);
    expect(sale.status).toBe("pagada");
    expect(Number(sale.ticket_number)).toBeGreaterThan(0);
    expect((await variantBySku("MATE-NEG-G")).stock).toBe(11);

    const items = await as(staffId, () => rows("select product_name, variant_label, quantity, unit_price from public.sale_items where sale_id = $1", [r.id]));
    expect(items).toEqual([{ product_name: "Mate Imperial", variant_label: "Negro / Grande", quantity: 2, unit_price: "11000.00" }]);

    const costs = await as(adminId, () => rows("select unit_cost from public.sale_item_costs"));
    expect(Number(costs[0].unit_cost)).toBe(6500);

    // el costo congelado no cambia aunque cambie el costo actual
    await as(adminId, () => rows("select public.register_stock_in($1, 1, 9999, 'Compra cara')", [negId]));
    expect(Number((await as(adminId, () => rows("select unit_cost from public.sale_item_costs")))[0].unit_cost)).toBe(6500);
  });

  it("aplica recargo de tarjeta y descuento", async () => {
    await rows("update public.store_settings set surcharge_tarjeta = 10");
    const [r] = await as(staffId, () =>
      rows("select public.create_sale($1, 'tarjeta', $2::jsonb, 1000) as id", [sessionId, JSON.stringify([{ variant_id: negId, quantity: 1 }])]),
    );
    const [sale] = await rows("select * from public.sales where id = $1", [r.id]);
    // (11000 - 1000) * 1.10
    expect(Number(sale.surcharge_pct)).toBe(10);
    expect(Number(sale.surcharge_amount)).toBe(1000);
    expect(Number(sale.total)).toBe(11000);
  });

  it("discrimina IVA solo si está configurado", async () => {
    await rows("update public.store_settings set show_vat = true, vat_rate = 21");
    const [r] = await as(staffId, () =>
      rows("select public.create_sale($1, 'transferencia', $2::jsonb) as id", [sessionId, JSON.stringify([{ variant_id: negId, quantity: 1 }])]),
    );
    const [sale] = await rows("select * from public.sales where id = $1", [r.id]);
    expect(Number(sale.total)).toBe(11000);
    expect(Number(sale.net_amount)).toBe(9090.91);
    expect(Number(sale.vat_amount)).toBeCloseTo(1909.09, 2);
    await rows("update public.store_settings set show_vat = false");
  });

  it("si falta stock, la venta falla entera y no deja nada a medias", async () => {
    const termo = await variantBySku("TERMO-1"); // stock 4
    const before = (await rows("select count(*)::int as n from public.sales"))[0].n;
    await expect(
      as(staffId, () =>
        rows("select public.create_sale($1, 'efectivo', $2::jsonb)", [
          sessionId,
          JSON.stringify([{ variant_id: negId, quantity: 1 }, { variant_id: termo.id, quantity: 5 }]),
        ]),
      ),
    ).rejects.toThrow(/Stock insuficiente/);
    expect((await rows("select count(*)::int as n from public.sales"))[0].n).toBe(before);
    expect((await variantBySku("TERMO-1")).stock).toBe(4);
  });

  it("valida cantidades, descuento, productos inactivos y caja cerrada", async () => {
    const item = (q: number) => JSON.stringify([{ variant_id: negId, quantity: q }]);
    await expect(as(staffId, () => rows("select public.create_sale($1, 'efectivo', $2::jsonb)", [sessionId, item(0)]))).rejects.toThrow(/Cantidad inválida/);
    await expect(as(staffId, () => rows("select public.create_sale($1, 'efectivo', $2::jsonb, 999999)", [sessionId, item(1)]))).rejects.toThrow(/descuento/);
    await expect(as(staffId, () => rows("select public.create_sale($1, 'efectivo', '[]')", [sessionId]))).rejects.toThrow(/no tiene productos/);
    const inactive = await variantBySku("MATE-MAR-C");
    await expect(
      as(staffId, () => rows("select public.create_sale($1, 'efectivo', $2::jsonb)", [sessionId, JSON.stringify([{ variant_id: inactive.id, quantity: 1 }])])),
    ).rejects.toThrow(/ya no está disponible/);
  });

  it("solo el admin anula ventas y el stock vuelve", async () => {
    const [sale] = await rows("select id from public.sales where payment_method = 'efectivo' limit 1");
    const stockBefore = (await variantBySku("MATE-NEG-G")).stock;
    await expect(as(staffId, () => rows("select public.void_sale($1, 'x')", [sale.id]))).rejects.toThrow(/Permiso denegado/);
    await expect(as(adminId, () => rows("select public.void_sale($1, '')", [sale.id]))).rejects.toThrow(/motivo/);
    await as(adminId, () => rows("select public.void_sale($1, 'Error de carga')", [sale.id]));

    const [after] = await rows("select status, void_reason from public.sales where id = $1", [sale.id]);
    expect(after).toEqual({ status: "anulada", void_reason: "Error de carga" });
    expect((await variantBySku("MATE-NEG-G")).stock).toBe(stockBefore + 2);
    await expect(as(adminId, () => rows("select public.void_sale($1, 'otra vez')", [sale.id]))).rejects.toThrow(/ya está anulada/);
  });

  it("el arqueo suma ventas en efectivo y movimientos, sin contar anuladas", async () => {
    await as(staffId, () => rows("select public.add_cash_movement($1, 'ingreso', 500, 'Cambio')", [sessionId]));
    await as(staffId, () => rows("select public.add_cash_movement($1, 'egreso', 200, 'Librería')", [sessionId]));
    await expect(as(staffId, () => rows("select public.add_cash_movement($1, 'egreso', 0, 'x')", [sessionId]))).rejects.toThrow();

    const [s] = await as(staffId, () => rows("select * from public.cash_session_summary where session_id = $1", [sessionId]));
    // la única venta en efectivo (22000) fue anulada
    expect(Number(s.cash_sales)).toBe(0);
    expect(Number(s.card_sales)).toBe(11000);
    expect(Number(s.transfer_sales)).toBe(11000);
    expect(Number(s.expected_cash)).toBe(1000 + 0 + 500 - 200);
  });

  it("cierra la caja con diferencia y no admite más ventas", async () => {
    await as(staffId, () => rows("select public.close_cash_session($1, 1250, 1000, 'Faltan 50')", [sessionId]));
    const [s] = await rows("select status, expected_cash, counted_cash, difference, cash_left from public.cash_sessions where id = $1", [sessionId]);
    expect(s.status).toBe("cerrada");
    expect(Number(s.expected_cash)).toBe(1300);
    expect(Number(s.difference)).toBe(-50);
    expect(Number(s.cash_left)).toBe(1000);

    await expect(
      as(staffId, () => rows("select public.create_sale($1, 'efectivo', $2::jsonb)", [sessionId, JSON.stringify([{ variant_id: negId, quantity: 1 }])])),
    ).rejects.toThrow(/no está abierta/);
    await expect(as(staffId, () => rows("select public.close_cash_session($1, 0)", [sessionId]))).rejects.toThrow(/no está abierta/);
    await expect(as(staffId, () => rows("select public.add_cash_movement($1, 'ingreso', 1, 'x')", [sessionId]))).rejects.toThrow(/no está abierta/);

    // y se puede abrir una nueva
    await openCash(adminId, 1000);
  });

  it("no deja dejar en caja más de lo contado", async () => {
    const id = (await rows("select id from public.cash_sessions where status = 'abierta'"))[0].id;
    await expect(as(adminId, () => rows("select public.close_cash_session($1, 100, 500)", [id]))).rejects.toThrow(/no puede superar/);
  });
});

describe("panel de stock", () => {
  it("genera el SKU cuando se deja vacío y lo conserva al editar", async () => {
    const id = await saveProduct(adminId, {
      name: "Yerba Suave 1kg", slug: "yerba-suave", variants: [{ sku: "", price: 5000 }, { sku: "  ", attributes: { Sabor: "Menta" }, price: 5200 }],
    });
    const skus = (await rows("select sku from public.product_variants where product_id = $1 order by sku", [id])).map((r) => r.sku);
    expect(skus).toHaveLength(2);
    expect(skus.every((s) => /^EM-\d{5}$/.test(s))).toBe(true);

    const [first] = await rows("select id, sku, attributes from public.product_variants where product_id = $1 order by sku limit 1", [id]);
    await saveProduct(adminId, { id, name: "Yerba Suave 1kg", slug: "yerba-suave", variants: [{ id: first.id, sku: "", attributes: first.attributes, price: 5100 }] });
    expect((await rows("select sku from public.product_variants where id = $1", [first.id]))[0].sku).toBe(first.sku);
  });

  it("el recuento fija el stock real, registra la diferencia y solo lo hace el admin", async () => {
    const v = await variantBySku("TERMO-1"); // stock 4
    const [r] = await as(adminId, () => rows("select public.count_stock($1, 7, 'Apareció una caja') as delta", [v.id]));
    expect(r.delta).toBe(3);
    expect((await variantBySku("TERMO-1")).stock).toBe(7);
    const [m] = await rows("select type, quantity, reason from public.stock_movements where variant_id = $1 order by id desc limit 1", [v.id]);
    expect(m).toEqual({ type: "ajuste", quantity: 3, reason: "Recuento (había 4): Apareció una caja" });

    // mismo valor: no genera movimiento
    const before = (await rows("select count(*)::int n from public.stock_movements"))[0].n;
    const [same] = await as(adminId, () => rows("select public.count_stock($1, 7) as delta", [v.id]));
    expect(same.delta).toBe(0);
    expect((await rows("select count(*)::int n from public.stock_movements"))[0].n).toBe(before);

    await as(adminId, () => rows("select public.count_stock($1, 0)", [v.id])); // bajar a cero es válido
    expect((await variantBySku("TERMO-1")).stock).toBe(0);
    await expect(as(adminId, () => rows("select public.count_stock($1, -1)", [v.id]))).rejects.toThrow(/negativo/);
    await expect(as(staffId, () => rows("select public.count_stock($1, 5)", [v.id]))).rejects.toThrow(/Permiso denegado/);
    await as(adminId, () => rows("select public.count_stock($1, 4)", [v.id])); // deja el dato como estaba
  });

  it("stock_overview: el admin ve el costo y el empleado no", async () => {
    const asAdmin = await as(adminId, () => rows("select cost, variant_label, product_name from public.stock_overview where sku = 'MATE-NEG-G'"));
    expect(Number(asAdmin[0].cost)).toBe(9999);
    expect(asAdmin[0].variant_label).toBe("Negro / Grande");

    const asStaff = await as(staffId, () => rows("select cost, price from public.stock_overview where sku = 'MATE-NEG-G'"));
    expect(asStaff).toHaveLength(1);
    expect(asStaff[0].cost).toBeNull();
    expect(Number(asStaff[0].price)).toBe(11000);
  });

  it("stock_overview oculta productos archivados y anon no accede", async () => {
    await rows("update public.products set archived_at = now() where slug = 'yerba-suave'");
    expect(await as(adminId, () => rows("select 1 from public.stock_overview where product_name = 'Yerba Suave 1kg'"))).toHaveLength(0);
    await expect(as("anon", () => rows("select * from public.stock_overview"))).rejects.toThrow(/permission denied/);
    await expect(as("anon", () => rows("select * from public.stock_movement_log"))).rejects.toThrow(/permission denied/);
  });

  it("el historial muestra tipo, saldo, motivo, usuario y ticket", async () => {
    const log = await as(staffId, () =>
      rows("select type, quantity, stock_after, reason, created_by_name, ticket_number from public.stock_movement_log where sku = 'MATE-NEG-G' order by id"),
    );
    const types = log.map((m) => m.type);
    expect(types).toEqual(expect.arrayContaining(["ingreso", "ajuste", "venta", "anulacion"]));
    // saldo coherente: cada movimiento deja stock_after = anterior + cantidad
    for (let i = 1; i < log.length; i++) expect(log[i].stock_after).toBe(log[i - 1].stock_after + log[i].quantity);
    const sale = log.find((m) => m.type === "venta");
    expect(sale?.created_by_name).toBe("caja"); // el empleado ve nombres de otros usuarios
    expect(Number(sale?.ticket_number)).toBeGreaterThan(0);
    expect(log.find((m) => m.type === "ajuste")?.reason).toBe("Rotura");
  });
});

describe("web pública: ofertas, categorías y más vendidos", () => {
  it("el precio anterior tiene que ser mayor al precio", async () => {
    await expect(
      saveProduct(adminId, { name: "Mate mal", slug: "mate-mal", variants: [{ sku: "MAL-1", price: 1000, compare_at_price: 900 }] }),
    ).rejects.toThrow(/check|compare_at_price/i);
  });

  it("la tarjeta muestra la variante más barata con su precio anterior y % de descuento", async () => {
    const [cat] = await rows("insert into public.categories (name, slug) values ('Termos', 'termos') returning id");
    await saveProduct(adminId, {
      name: "Termo Oferta",
      slug: "termo-oferta",
      category_id: cat.id,
      option_names: ["Color"],
      variants: [
        { sku: "TO-VERDE", attributes: { Color: "Verde" }, price: 50000, compare_at_price: 60000, initial_stock: 3 },
        { sku: "TO-NEGRO", attributes: { Color: "Negro" }, price: 55000 },
      ],
    });
    const [p] = await as("anon", () => rows("select * from public.public_products where slug = 'termo-oferta'"));
    expect(Number(p.price)).toBe(50000);
    expect(Number(p.compare_at_price)).toBe(60000);
    expect(p.discount_pct).toBe(17);
    expect(p.variant_count).toBe(2);
    expect(p.has_price_range).toBe(true); // 50.000 y 55.000
    expect(p.in_stock).toBe(true);
    expect(p.category_slug).toBe("termos");

    const variants = await as("anon", () => rows("select label, in_stock from public.public_variants where product_id = $1 order by label", [p.id]));
    expect(variants).toEqual([
      { label: "Negro", in_stock: false },
      { label: "Verde", in_stock: true },
    ]);
  });

  it("las categorías cuentan solo productos visibles", async () => {
    const count = async () =>
      (await as("anon", () => rows("select product_count from public.public_categories where slug = 'termos'")))[0].product_count;
    expect(await count()).toBe(1);
    await rows("update public.products set is_visible = false where slug = 'termo-oferta'");
    expect(await count()).toBe(0);
    await rows("update public.products set is_visible = true where slug = 'termo-oferta'");
  });

  it("los más vendidos salen de ventas pagadas, sin exponer cantidades", async () => {
    const best = await as("anon", () => rows("select * from public.public_best_sellers"));
    expect(Object.keys(best[0]).sort()).toEqual(["product_id", "rank"]);
    const [mate] = await rows("select id from public.products where slug = 'mate-imperial'");
    expect(best.find((b) => b.rank === 1)?.product_id).toBe(mate.id);
    // anon no puede leer las ventas de las que sale el ranking
    await expect(as("anon", () => rows("select * from public.sale_items"))).rejects.toThrow(/permission denied/);
  });
});
