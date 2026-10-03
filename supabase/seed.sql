-- Datos de ejemplo para desarrollo local (supabase db reset). No usar en producción:
-- los productos reales vienen del Excel del cliente.

insert into public.categories (name, slug, sort_order) values
  ('Mates', 'mates', 1),
  ('Bombillas', 'bombillas', 2),
  ('Termos', 'termos', 3),
  ('Yerbas', 'yerbas', 4),
  ('Accesorios', 'accesorios', 5);

insert into public.suppliers (name) values ('Artesanías del Litoral'), ('Distribuidora Norte');

update public.store_settings set
  name = 'El Mate',
  tagline = 'Todo para tu ronda',
  surcharge_tarjeta = 10,
  show_vat = false;

-- Las funciones de negocio exigen un admin logueado; el seed corre como postgres, así que
-- se inserta directo respetando el mismo modelo (variante + costo + movimiento de ingreso).
do $$
declare
  v_cat_mates uuid := (select id from public.categories where slug = 'mates');
  v_cat_termos uuid := (select id from public.categories where slug = 'termos');
  v_sup uuid := (select id from public.suppliers where name = 'Artesanías del Litoral');
  v_product uuid;
  v_variant uuid;
  r record;
begin
  insert into public.products (name, slug, description, category_id, supplier_id, option_names, is_visible, is_featured, badge)
  values ('Mate Imperial', 'mate-imperial', 'Calabaza forrada en cuero con virola de alpaca.', v_cat_mates, v_sup,
          array['Color', 'Tamaño'], true, true, 'Más vendido')
  returning id into v_product;

  for r in
    select * from (values
      ('MATE-IMP-NEG-G', '{"Color":"Negro","Tamaño":"Grande"}'::jsonb, 18500, 9800, 12, 3),
      ('MATE-IMP-NEG-C', '{"Color":"Negro","Tamaño":"Chico"}'::jsonb, 16500, 8700, 8, 3),
      ('MATE-IMP-MAR-G', '{"Color":"Marrón","Tamaño":"Grande"}'::jsonb, 18500, 9800, 2, 3)
    ) as t(sku, attrs, price, cost, stock, min_stock)
  loop
    insert into public.product_variants (product_id, sku, attributes, price, min_stock)
    values (v_product, r.sku, r.attrs, r.price, r.min_stock) returning id into v_variant;
    insert into public.variant_costs (variant_id, cost) values (v_variant, r.cost);
    insert into public.stock_movements (variant_id, type, quantity, reason)
    values (v_variant, 'ingreso', r.stock, 'Stock inicial');
  end loop;

  insert into public.products (name, slug, description, category_id, option_names)
  values ('Termo Acero 1L', 'termo-acero-1l', 'Mantiene el agua caliente 24 horas.', v_cat_termos, array['Color'])
  returning id into v_product;

  for r in
    select * from (values
      ('TERMO-1L-ACE', '{"Color":"Acero"}'::jsonb, 42000, 24000, 6, 2),
      ('TERMO-1L-NEG', '{"Color":"Negro"}'::jsonb, 42000, 24000, 0, 2)
    ) as t(sku, attrs, price, cost, stock, min_stock)
  loop
    insert into public.product_variants (product_id, sku, attributes, price, min_stock)
    values (v_product, r.sku, r.attrs, r.price, r.min_stock) returning id into v_variant;
    insert into public.variant_costs (variant_id, cost) values (v_variant, r.cost);
    if r.stock > 0 then
      insert into public.stock_movements (variant_id, type, quantity, reason)
      values (v_variant, 'ingreso', r.stock, 'Stock inicial');
    end if;
  end loop;
end $$;
