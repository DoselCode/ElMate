-- ElMate · web pública (Diseño 2): ofertas, categorías con foto, más vendidos y redes.
-- Va encima de 20261002000000_core_schema.sql, que ya está aplicada en la base real.

-- ---------------------------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------------------------
-- "Precio anterior" para mostrar tachado en la web (oferta). Opcional; si está, es mayor al precio.
alter table public.product_variants
  add column compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price > price);

-- Foto de la tarjeta de categoría en la web
alter table public.categories add column image text;

alter table public.store_settings add column facebook_url text;

-- ---------------------------------------------------------------------------------------------
-- save_product() ahora guarda también el precio anterior
-- ---------------------------------------------------------------------------------------------
-- Alta o edición de un producto con todas sus variantes, en una sola transacción.
-- p = { id?, name, slug, description?, category_id?, supplier_id?, option_names?[], images?[],
--       is_visible?, badge?, variants: [{ id?, sku, barcode?, attributes?, price, compare_at_price?,
--       cost?, min_stock?, image?, active?, initial_stock? }] }
-- Las variantes existentes que no vengan en la lista se desactivan (no se borran: tienen historial).
create or replace function public.save_product(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v jsonb;
  v_variant_id uuid;
  v_is_new boolean;
  v_keep uuid[] := '{}';
  v_initial integer;
begin
  perform public.require_admin();

  if jsonb_typeof(p -> 'variants') is distinct from 'array' or jsonb_array_length(p -> 'variants') = 0 then
    raise exception 'El producto necesita al menos una variante';
  end if;

  if v_id is null then
    insert into public.products (name, slug, description, category_id, supplier_id, option_names, images, is_visible, badge)
    values (
      p ->> 'name', p ->> 'slug', coalesce(p ->> 'description', ''),
      nullif(p ->> 'category_id', '')::uuid, nullif(p ->> 'supplier_id', '')::uuid,
      array(select jsonb_array_elements_text(p -> 'option_names')),
      array(select jsonb_array_elements_text(p -> 'images')),
      coalesce((p ->> 'is_visible')::boolean, true), nullif(p ->> 'badge', '')
    ) returning id into v_id;
  else
    update public.products set
      name = p ->> 'name', slug = p ->> 'slug', description = coalesce(p ->> 'description', ''),
      category_id = nullif(p ->> 'category_id', '')::uuid, supplier_id = nullif(p ->> 'supplier_id', '')::uuid,
      option_names = array(select jsonb_array_elements_text(p -> 'option_names')),
      images = array(select jsonb_array_elements_text(p -> 'images')),
      is_visible = coalesce((p ->> 'is_visible')::boolean, true), badge = nullif(p ->> 'badge', ''),
      archived_at = null
     where id = v_id;
    if not found then
      raise exception 'El producto no existe';
    end if;
  end if;

  for v in select e from jsonb_array_elements(p -> 'variants') e loop
    v_variant_id := nullif(v ->> 'id', '')::uuid;
    v_is_new := v_variant_id is null;

    if v_is_new then
      insert into public.product_variants (product_id, sku, barcode, attributes, price, compare_at_price, min_stock, image, active)
      values (
        v_id, upper(coalesce(nullif(btrim(v ->> 'sku'), ''), public.next_sku())),
        nullif(btrim(v ->> 'barcode'), ''), coalesce(v -> 'attributes', '{}'::jsonb),
        (v ->> 'price')::numeric, (v ->> 'compare_at_price')::numeric, coalesce((v ->> 'min_stock')::integer, 0),
        nullif(v ->> 'image', ''), coalesce((v ->> 'active')::boolean, true)
      ) returning id into v_variant_id;

      v_initial := coalesce((v ->> 'initial_stock')::integer, 0);
      if v_initial > 0 then
        insert into public.stock_movements (variant_id, type, quantity, reason)
        values (v_variant_id, 'ingreso', v_initial, 'Stock inicial');
      end if;
    else
      update public.product_variants set
        sku = upper(coalesce(nullif(btrim(v ->> 'sku'), ''), sku)), barcode = nullif(btrim(v ->> 'barcode'), ''),
        attributes = coalesce(v -> 'attributes', '{}'::jsonb), price = (v ->> 'price')::numeric,
        compare_at_price = (v ->> 'compare_at_price')::numeric,
        min_stock = coalesce((v ->> 'min_stock')::integer, 0), image = nullif(v ->> 'image', ''),
        active = coalesce((v ->> 'active')::boolean, true)
       where id = v_variant_id and product_id = v_id;
      if not found then
        raise exception 'La variante % no pertenece al producto', v_variant_id;
      end if;
    end if;

    if v_is_new or v ? 'cost' then
      insert into public.variant_costs (variant_id, cost)
      values (v_variant_id, coalesce((v ->> 'cost')::numeric, 0))
      on conflict (variant_id) do update set cost = excluded.cost;
    end if;

    v_keep := v_keep || v_variant_id;
  end loop;

  update public.product_variants set active = false where product_id = v_id and id <> all (v_keep) and active;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Vistas públicas: se recrean con precio anterior, % de descuento, "Desde", conteo por categoría
-- y más vendidos. Siguen sin exponer costos ni stock exacto.
-- ---------------------------------------------------------------------------------------------
drop view public.public_categories;
drop view public.public_variants;
drop view public.public_products;
drop view public.public_store_info;

-- Un producto aparece en la web si está visible, no archivado y tiene al menos una variante activa.
-- La tarjeta muestra la variante más barata: su precio, su precio anterior y su % de descuento.
create view public.public_products as
select
  p.id, p.name, p.slug, p.description, p.images, p.badge, p.is_featured, p.option_names, p.created_at,
  c.name as category_name, c.slug as category_slug,
  cheapest.variant_id,
  cheapest.price,
  cheapest.compare_at_price,
  case when cheapest.compare_at_price is not null
       then round(100 * (1 - cheapest.price / cheapest.compare_at_price))::integer end as discount_pct,
  stats.variant_count,
  stats.has_price_range,
  stats.in_stock
from public.products p
left join public.categories c on c.id = p.category_id
cross join lateral (
  select id as variant_id, price, compare_at_price
  from public.product_variants
  where product_id = p.id and active
  order by price, created_at
  limit 1
) cheapest
cross join lateral (
  select count(*)::integer as variant_count,
         count(distinct price) > 1 as has_price_range, -- la tarjeta dice "Desde" solo si hay precios distintos
         coalesce(bool_or(stock > 0), false) as in_stock
  from public.product_variants where product_id = p.id and active
) stats
where p.is_visible and p.archived_at is null;

create view public.public_variants as
select pv.id, pv.product_id, pv.attributes, public.variant_label(pv.attributes, p.option_names) as label,
       pv.price, pv.compare_at_price, pv.image, (pv.stock > 0) as in_stock
from public.product_variants pv
join public.products p on p.id = pv.product_id
where pv.active and p.is_visible and p.archived_at is null;

-- Categorías con la cantidad de productos que se ven en la web.
create view public.public_categories as
select c.id, c.name, c.slug, c.image, c.sort_order,
       (select count(*)::integer from public.public_products pp where pp.category_slug = c.slug) as product_count
from public.categories c;

-- Los más vendidos de los últimos 90 días (solo el orden, sin exponer cantidades).
create view public.public_best_sellers as
select pv.product_id, row_number() over (order by sum(si.quantity) desc, pv.product_id)::integer as rank
from public.sale_items si
join public.sales s on s.id = si.sale_id and s.status = 'pagada' and s.created_at > now() - interval '90 days'
join public.product_variants pv on pv.id = si.variant_id
where exists (select 1 from public.public_products pp where pp.id = pv.product_id)
group by pv.product_id
order by rank
limit 12;

create view public.public_store_info as
select name, tagline, logo, phone, whatsapp_number, email, address, instagram_url, facebook_url,
       hours_weekdays, hours_saturday, hours_sunday
from public.store_settings;

-- ---------------------------------------------------------------------------------------------
-- Privilegios: lo nuevo arranca sin permisos (ver core_schema); se concede solo lectura pública.
-- ---------------------------------------------------------------------------------------------
revoke all on public.public_categories, public.public_products, public.public_variants,
  public.public_best_sellers, public.public_store_info from anon, authenticated;
grant select on public.public_categories, public.public_products, public.public_variants,
  public.public_best_sellers, public.public_store_info to anon, authenticated;
-- Postgres chequea EXECUTE con el usuario que consulta aunque la vista sea del dueño:
-- public_variants usa variant_label (función pura, solo arma "Negro / Grande").
grant execute on function public.variant_label(jsonb, text[]) to anon;