-- ElMate · promociones, cards por fecha especial y personalización por producto (grabado / detalle).
-- Es aditivo: no borra datos. Cambia las vistas públicas para que el precio de una promo vigente se
-- vea como precio con descuento (el precio normal pasa a "precio anterior") en la web y el carrito.
-- El punto de venta del local no cambia: sigue vendiendo al precio de lista.

-- ---------------------------------------------------------------------------------------------
-- 1. Personalización por producto
-- ---------------------------------------------------------------------------------------------
-- Si tiene texto, la web le pide al cliente un detalle al comprar (ej. "¿Qué querés grabar?").
alter table public.products
  add column customization_label text check (customization_label is null or char_length(btrim(customization_label)) between 2 and 80);

-- ---------------------------------------------------------------------------------------------
-- 2. Promociones: precio especial por variante, con fechas, y card opcional en la home
-- ---------------------------------------------------------------------------------------------
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  -- null = sin fecha de fin
  ends_at timestamptz,
  -- Card en la home mientras la promo esté vigente
  show_card boolean not null default false,
  card_title text check (card_title is null or char_length(card_title) <= 80),
  card_text text check (card_text is null or char_length(card_text) <= 200),
  card_cta text check (card_cta is null or char_length(card_cta) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create trigger promotions_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();

create table public.promotion_items (
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  promo_price numeric(12, 2) not null check (promo_price > 0),
  primary key (promotion_id, variant_id)
);
create index promotion_items_variant_idx on public.promotion_items (variant_id);

alter table public.promotions enable row level security;
alter table public.promotion_items enable row level security;
create policy promotions_admin on public.promotions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy promotion_items_admin on public.promotion_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Promos vigentes ahora: activas y dentro de sus fechas.
create view public.live_promotions as
select * from public.promotions
where active and starts_at <= now() and (ends_at is null or ends_at > now());

-- El mejor (más bajo) precio promocional vigente de cada variante.
create view public.live_promo_prices as
select pi.variant_id, min(pi.promo_price) as promo_price
from public.promotion_items pi
join public.live_promotions lp on lp.id = pi.promotion_id
group by pi.variant_id;

-- Guarda una promo completa con sus precios, de una vez.
-- p = { id?, name, slug, description?, active?, starts_at?, ends_at?, show_card?, card_title?, card_text?,
--       card_cta?, items: [ { variant_id, promo_price } ] }
create or replace function public.save_promotion(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_items jsonb := coalesce(p -> 'items', '[]'::jsonb);
begin
  perform public.require_admin();
  if jsonb_typeof(v_items) is distinct from 'array' then
    raise exception 'Los productos de la promo tienen que ser una lista';
  end if;

  if v_id is null then
    insert into public.promotions (name, slug, description, active, starts_at, ends_at, show_card, card_title, card_text, card_cta)
    values (
      btrim(p ->> 'name'), p ->> 'slug', coalesce(p ->> 'description', ''),
      coalesce((p ->> 'active')::boolean, true), coalesce(nullif(p ->> 'starts_at', '')::timestamptz, now()),
      nullif(p ->> 'ends_at', '')::timestamptz, coalesce((p ->> 'show_card')::boolean, false),
      nullif(btrim(p ->> 'card_title'), ''), nullif(btrim(p ->> 'card_text'), ''), nullif(btrim(p ->> 'card_cta'), '')
    ) returning id into v_id;
  else
    update public.promotions set
      name = btrim(p ->> 'name'), slug = p ->> 'slug', description = coalesce(p ->> 'description', ''),
      active = coalesce((p ->> 'active')::boolean, true),
      starts_at = coalesce(nullif(p ->> 'starts_at', '')::timestamptz, starts_at),
      ends_at = nullif(p ->> 'ends_at', '')::timestamptz,
      show_card = coalesce((p ->> 'show_card')::boolean, false),
      card_title = nullif(btrim(p ->> 'card_title'), ''), card_text = nullif(btrim(p ->> 'card_text'), ''),
      card_cta = nullif(btrim(p ->> 'card_cta'), '')
     where id = v_id;
    if not found then
      raise exception 'La promoción no existe';
    end if;
    delete from public.promotion_items where promotion_id = v_id;
  end if;

  insert into public.promotion_items (promotion_id, variant_id, promo_price)
  select v_id, (e ->> 'variant_id')::uuid, (e ->> 'promo_price')::numeric
  from jsonb_array_elements(v_items) e;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 3. save_product(): guarda también el texto de personalización (si no viene, no se toca)
-- ---------------------------------------------------------------------------------------------
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
                                 option_names, images, is_visible, badge, is_featured, show_in_news, web_order, customization_label)
    values (
      p ->> 'name', p ->> 'slug', coalesce(p ->> 'description', ''),
      nullif(p ->> 'category_id', '')::uuid, nullif(p ->> 'supplier_id', '')::uuid,
      nullif(btrim(p ->> 'brand'), ''), coalesce(nullif(p ->> 'unit', ''), 'unidad'),
      coalesce((p ->> 'track_stock')::boolean, true),
      array(select jsonb_array_elements_text(p -> 'option_names')),
      array(select jsonb_array_elements_text(p -> 'images')),
      coalesce((p ->> 'is_visible')::boolean, true), nullif(p ->> 'badge', ''),
      coalesce((p ->> 'is_featured')::boolean, false), coalesce((p ->> 'show_in_news')::boolean, true),
      nullif(p ->> 'web_order', '')::integer, nullif(btrim(p ->> 'customization_label'), '')
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
      customization_label = case when p ? 'customization_label' then nullif(btrim(p ->> 'customization_label'), '') else customization_label end,
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

-- ---------------------------------------------------------------------------------------------
-- 4. Vistas públicas con el precio de la promo vigente.
-- El precio mostrado es el de la promo (si es menor que el de lista) y el de lista pasa a ser el
-- "precio anterior": la web lo muestra tachado y calcula el % de descuento sola.
-- ---------------------------------------------------------------------------------------------
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
  p.web_order,
  p.customization_label
from public.products p
left join public.categories c on c.id = p.category_id
cross join lateral (
  select pv.id as variant_id,
         (case when lp.promo_price < pv.price then lp.promo_price else pv.price end)::numeric(12, 2) as price,
         (case when lp.promo_price < pv.price then pv.price else pv.compare_at_price end)::numeric(12, 2) as compare_at_price
  from public.product_variants pv
  left join public.live_promo_prices lp on lp.variant_id = pv.id
  where pv.product_id = p.id and pv.active and pv.price > 0
  order by 2, pv.created_at
  limit 1
) cheapest
cross join lateral (
  select count(*)::integer as variant_count,
         count(distinct case when lp.promo_price < pv.price then lp.promo_price else pv.price end) > 1 as has_price_range,
         coalesce(bool_or(pv.stock > 0 or not p.track_stock), false) as in_stock
  from public.product_variants pv
  left join public.live_promo_prices lp on lp.variant_id = pv.id
  where pv.product_id = p.id and pv.active and pv.price > 0
) stats
where p.is_visible and p.archived_at is null;

create or replace view public.public_variants as
select pv.id, pv.product_id, pv.attributes, public.variant_label(pv.attributes, p.option_names) as label,
       (case when lp.promo_price < pv.price then lp.promo_price else pv.price end)::numeric(12, 2) as price,
       (case when lp.promo_price < pv.price then pv.price else pv.compare_at_price end)::numeric(12, 2) as compare_at_price,
       pv.image, (pv.stock > 0 or not p.track_stock) as in_stock
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.live_promo_prices lp on lp.variant_id = pv.id
where pv.active and pv.price > 0 and p.is_visible and p.archived_at is null;

-- Promos vigentes (la home muestra la card de las que tienen show_card) y cuántos productos tienen.
create view public.public_promotions as
select lp.id, lp.name, lp.slug, lp.description, lp.show_card, lp.card_title, lp.card_text, lp.card_cta, lp.starts_at, lp.ends_at,
       (select count(distinct pv.product_id)::integer
          from public.promotion_items pi join public.product_variants pv on pv.id = pi.variant_id
         where pi.promotion_id = lp.id) as product_count
from public.live_promotions lp;

-- Qué productos tiene cada promo vigente (para listarlos en /tienda?promo=...).
create view public.public_promotion_products as
select distinct lp.slug as promotion_slug, pv.product_id
from public.live_promotions lp
join public.promotion_items pi on pi.promotion_id = lp.id
join public.product_variants pv on pv.id = pi.variant_id;

-- ---------------------------------------------------------------------------------------------
-- 5. Privilegios: lo nuevo arranca sin permisos (ver core_schema); se concede explícito.
-- ---------------------------------------------------------------------------------------------
revoke all on public.promotions, public.promotion_items, public.live_promotions, public.live_promo_prices,
  public.public_promotions, public.public_promotion_products from anon, authenticated;
grant select, insert, update, delete on public.promotions, public.promotion_items to authenticated;
grant select on public.public_promotions, public.public_promotion_products to anon, authenticated;
grant execute on function public.save_promotion(jsonb) to authenticated;
