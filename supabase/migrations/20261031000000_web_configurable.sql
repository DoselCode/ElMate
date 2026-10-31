-- ElMate · la web se configura desde el panel.
-- 1) Opciones de cada producto para la web: varios destacados, mostrar o no en "Novedades" y orden manual.
-- 2) Textos de la home editables (título, subtítulo, secciones...), guardados en una sola fila.
-- Es aditivo: no borra datos ni cambia columnas existentes.

-- ---------------------------------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------------------------------
alter table public.products
  add column show_in_news boolean not null default true,
  add column web_order integer check (web_order is null or web_order between 0 and 9999);

-- Antes solo podía haber un destacado; ahora se pueden marcar todos los que se quiera.
drop index if exists public.products_single_featured;

-- save_product() guarda también las opciones de la web. Si el dato no viene en el pedido, no se toca.
-- p = { id?, name, slug, ..., is_visible?, badge?, is_featured?, show_in_news?, web_order?,
--       variants: [ ... ] }  (el resto es igual que en 20261018000000)
create or replace function public.save_product(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v jsonb;
  v_variant_id uuid;
  v_is_new boolean;
  v_keep uuid[] := '{}';
  v_initial numeric(12, 3);
begin
  perform public.require_admin();

  if jsonb_typeof(p -> 'variants') is distinct from 'array' or jsonb_array_length(p -> 'variants') = 0 then
    raise exception 'El producto necesita al menos una variante';
  end if;

  if v_id is null then
    insert into public.products (name, slug, description, category_id, supplier_id, brand, unit, track_stock,
                                 option_names, images, is_visible, badge, is_featured, show_in_news, web_order)
    values (
      p ->> 'name', p ->> 'slug', coalesce(p ->> 'description', ''),
      nullif(p ->> 'category_id', '')::uuid, nullif(p ->> 'supplier_id', '')::uuid,
      nullif(btrim(p ->> 'brand'), ''), coalesce(nullif(p ->> 'unit', ''), 'unidad'),
      coalesce((p ->> 'track_stock')::boolean, true),
      array(select jsonb_array_elements_text(p -> 'option_names')),
      array(select jsonb_array_elements_text(p -> 'images')),
      coalesce((p ->> 'is_visible')::boolean, true), nullif(p ->> 'badge', ''),
      coalesce((p ->> 'is_featured')::boolean, false), coalesce((p ->> 'show_in_news')::boolean, true),
      nullif(p ->> 'web_order', '')::integer
    ) returning id into v_id;
  else
    update public.products set
      name = p ->> 'name', slug = p ->> 'slug', description = coalesce(p ->> 'description', ''),
      category_id = nullif(p ->> 'category_id', '')::uuid, supplier_id = nullif(p ->> 'supplier_id', '')::uuid,
      brand = nullif(btrim(p ->> 'brand'), ''), unit = coalesce(nullif(p ->> 'unit', ''), 'unidad'),
      track_stock = coalesce((p ->> 'track_stock')::boolean, true),
      option_names = array(select jsonb_array_elements_text(p -> 'option_names')),
      images = array(select jsonb_array_elements_text(p -> 'images')),
      is_visible = coalesce((p ->> 'is_visible')::boolean, true), badge = nullif(p ->> 'badge', ''),
      is_featured = case when p ? 'is_featured' then coalesce((p ->> 'is_featured')::boolean, false) else is_featured end,
      show_in_news = case when p ? 'show_in_news' then coalesce((p ->> 'show_in_news')::boolean, true) else show_in_news end,
      web_order = case when p ? 'web_order' then nullif(p ->> 'web_order', '')::integer else web_order end,
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
        (v ->> 'price')::numeric, (v ->> 'compare_at_price')::numeric, coalesce((v ->> 'min_stock')::numeric, 0),
        nullif(v ->> 'image', ''), coalesce((v ->> 'active')::boolean, true)
      ) returning id into v_variant_id;

      v_initial := coalesce((v ->> 'initial_stock')::numeric, 0);
      if v_initial > 0 then
        insert into public.stock_movements (variant_id, type, quantity, reason)
        values (v_variant_id, 'ingreso', v_initial, 'Stock inicial');
      end if;
    else
      update public.product_variants set
        sku = upper(coalesce(nullif(btrim(v ->> 'sku'), ''), sku)), barcode = nullif(btrim(v ->> 'barcode'), ''),
        attributes = coalesce(v -> 'attributes', '{}'::jsonb), price = (v ->> 'price')::numeric,
        compare_at_price = (v ->> 'compare_at_price')::numeric,
        min_stock = coalesce((v ->> 'min_stock')::numeric, 0), image = nullif(v ->> 'image', ''),
        active = coalesce((v ->> 'active')::boolean, true)
       where id = v_variant_id and product_id = v_id;
      if not found then
        raise exception 'La variante % no pertenece al producto', v_variant_id;
      end if;
    end if;

    if v_is_new or v ? 'cost' or v ? 'margin_pct' then
      insert into public.variant_costs (variant_id, cost, margin_pct)
      values (v_variant_id, coalesce((v ->> 'cost')::numeric, 0), (v ->> 'margin_pct')::numeric)
      on conflict (variant_id) do update set cost = excluded.cost, margin_pct = excluded.margin_pct;
    end if;

    v_keep := v_keep || v_variant_id;
  end loop;

  update public.product_variants set active = false where product_id = v_id and id <> all (v_keep) and active;
  return v_id;
end $$;

-- La web lee las opciones nuevas. Las dos columnas se agregan al final: create or replace conserva permisos.
create or replace view public.public_products as
select
  p.id, p.name, p.slug, p.description, p.images, p.badge, p.is_featured, p.option_names, p.created_at,
  p.brand, p.unit,
  c.name as category_name, c.slug as category_slug,
  cheapest.variant_id,
  cheapest.price,
  cheapest.compare_at_price,
  case when cheapest.compare_at_price is not null
       then round(100 * (1 - cheapest.price / cheapest.compare_at_price))::integer end as discount_pct,
  stats.variant_count,
  stats.has_price_range,
  stats.in_stock,
  p.show_in_news,
  p.web_order
from public.products p
left join public.categories c on c.id = p.category_id
cross join lateral (
  select id as variant_id, price, compare_at_price
  from public.product_variants
  where product_id = p.id and active and price > 0
  order by price, created_at
  limit 1
) cheapest
cross join lateral (
  select count(*)::integer as variant_count,
         count(distinct price) > 1 as has_price_range,
         coalesce(bool_or(stock > 0 or not p.track_stock), false) as in_stock
  from public.product_variants where product_id = p.id and active and price > 0
) stats
where p.is_visible and p.archived_at is null;

-- ---------------------------------------------------------------------------------------------
-- Textos de la home (una sola fila). Solo se guardan los que el usuario cambió: lo que falta
-- se completa en la web con los textos por defecto (front/landing/content.ts).
-- ---------------------------------------------------------------------------------------------
create table public.home_content (
  id integer primary key default 1 check (id = 1),
  texts jsonb not null default '{}'::jsonb check (jsonb_typeof(texts) = 'object'),
  updated_at timestamptz not null default now()
);
create trigger home_content_updated_at before update on public.home_content
  for each row execute function public.set_updated_at();
insert into public.home_content (id) values (1);

alter table public.home_content enable row level security;
create policy home_content_select on public.home_content for select to authenticated using (public.is_staff());
create policy home_content_update on public.home_content for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create view public.public_home_content as select texts from public.home_content;

-- Lo nuevo arranca sin permisos (ver core_schema): se concede de forma explícita.
grant select, update on public.home_content to authenticated;
revoke all on public.public_home_content from anon, authenticated;
grant select on public.public_home_content to anon, authenticated;
