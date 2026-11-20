-- =============================================================================================
-- Tienda: filtros laterales generados desde los datos.
-- 1. web_key(): texto libre -> clave de URL (igual que slugify() en src/shared/slug.ts).
-- 2. public_products suma brand_key, option_tags y option_tags_in_stock (al final de la vista).
-- 3. shop_facets(): opciones de cada filtro con su cantidad, contando cada faceta con todos los
--    filtros activos menos el suyo (facetas disyuntivas). Lee solo vistas públicas.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Clave de URL. Mantener igual a slugify(): sin tildes, minúsculas, solo a-z 0-9 y guiones.
-- ---------------------------------------------------------------------------------------------
create or replace function public.web_key(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(
    trim(both '-' from regexp_replace(
      lower(translate(coalesce(t, ''),
        'ÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãåéèëêíìïîóòöôõúùüûñç',
        'AAAAAAEEEEIIIIOOOOOUUUUNCaaaaaaeeeeiiiiooooouuuunc')),
      '[^a-z0-9]+', '-', 'g')),
    80)
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. public_products con las claves para filtrar. Mismas columnas que antes, más tres al final.
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
  p.customization_label,
  nullif(public.web_key(p.brand), '') as brand_key,
  tags.option_tags,
  tags.option_tags_in_stock
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
cross join lateral (
  -- "opción:valor" de las variantes activas; las con stock aparte para el filtro "En stock"
  select coalesce(array_agg(distinct t.tag order by t.tag), '{}') as option_tags,
         coalesce(array_agg(distinct t.tag order by t.tag) filter (where t.available), '{}') as option_tags_in_stock
  from (
    select public.web_key(a.key) || ':' || public.web_key(a.value) as tag,
           (pv.stock > 0 or not p.track_stock) as available
    from public.product_variants pv
    cross join lateral jsonb_each_text(pv.attributes) a
    where pv.product_id = p.id and pv.active and pv.price > 0
      and public.web_key(a.key) <> '' and public.web_key(a.value) <> ''
  ) t
) tags
where p.is_visible and p.archived_at is null;

-- ---------------------------------------------------------------------------------------------
-- 3. Facetas de la tienda.
-- p_filters = { q?, category?, ids?[], brands?[], price_min?, price_max?, options?: {clave: [valores]},
--               offers?, in_stock? }   (todas las claves ya en formato web_key)
-- ---------------------------------------------------------------------------------------------

-- El producto cumple todos los filtros de opción (O dentro de cada opción, Y entre opciones),
-- salvo el de la opción `skip`.
create or replace function public.shop_option_match(tags text[], opts jsonb, skip text default null)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(tags && array(select o.key || ':' || v from jsonb_array_elements_text(o.value) v)), true)
  from jsonb_each(coalesce(opts, '{}'::jsonb)) o
  where o.key is distinct from skip and jsonb_typeof(o.value) = 'array' and jsonb_array_length(o.value) > 0
$$;

create or replace function public.shop_facets(p_filters jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  f constant jsonb := coalesce(p_filters, '{}'::jsonb);
  v_words text[] := array(select w from regexp_split_to_table(btrim(coalesce(f ->> 'q', '')), '\s+') w where w <> '');
  v_cat text := nullif(f ->> 'category', '');
  v_ids uuid[] := case when jsonb_typeof(f -> 'ids') = 'array'
                       then array(select jsonb_array_elements_text(f -> 'ids')::uuid) end;
  v_brands text[] := case when jsonb_typeof(f -> 'brands') = 'array'
                          then array(select jsonb_array_elements_text(f -> 'brands')) else '{}' end;
  v_min numeric := nullif(f ->> 'price_min', '')::numeric;
  v_max numeric := nullif(f ->> 'price_max', '')::numeric;
  v_opts jsonb := case when jsonb_typeof(f -> 'options') = 'object' then f -> 'options' else '{}'::jsonb end;
  v_offers boolean := coalesce((f ->> 'offers')::boolean, false);
  v_stock boolean := coalesce((f ->> 'in_stock')::boolean, false);
  v_result jsonb;
begin
  with p as (
    select pp.id, pp.category_slug, pp.brand_key, pp.price, pp.in_stock, pp.compare_at_price, pp.option_tags_in_stock,
           case when v_stock then pp.option_tags_in_stock else pp.option_tags end as tags,
           (v_cat is null or pp.category_slug = v_cat) as m_cat,
           (cardinality(v_brands) = 0 or pp.brand_key = any (v_brands)) as m_brand,
           ((v_min is null or pp.price >= v_min) and (v_max is null or pp.price <= v_max)) as m_price,
           (not v_offers or pp.compare_at_price is not null) as m_offers,
           (not v_stock or pp.in_stock) as m_stock
    from public.public_products pp
    where (v_ids is null or pp.id = any (v_ids))
      and not exists (select 1 from unnest(v_words) w where pp.name not ilike '%' || w || '%')
  ),
  -- Nombres visibles: la forma más repetida de cada clave en todo el catálogo (estable entre filtros)
  brand_names as (
    select public.web_key(brand) as key, mode() within group (order by btrim(brand) collate "C") as name
    from public.public_products where brand_key is not null group by 1
  ),
  attr as (
    select public.web_key(a.key) as okey, btrim(a.key) as oname, public.web_key(a.value) as vkey, btrim(a.value) as vname
    from public.public_variants pv cross join lateral jsonb_each_text(pv.attributes) a
    where public.web_key(a.key) <> '' and public.web_key(a.value) <> ''
  ),
  option_names as (select okey, mode() within group (order by oname collate "C") as name from attr group by okey),
  value_names as (select okey, vkey, mode() within group (order by vname collate "C") as name from attr group by okey, vkey)
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name, 'count', x.n) order by c.sort_order, c.name)
      from (select category_slug, count(*)::integer as n from p
            where m_brand and m_price and m_offers and m_stock and public.shop_option_match(tags, v_opts)
              and category_slug is not null
            group by category_slug) x
      join public.public_categories c on c.slug = x.category_slug
    ), '[]'::jsonb),
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('value', bn.name, 'key', x.brand_key, 'count', x.n) order by x.n desc, bn.name collate "C")
      from (select brand_key, count(*)::integer as n from p
            where m_cat and m_price and m_offers and m_stock and public.shop_option_match(tags, v_opts)
              and brand_key is not null
            group by brand_key) x
      join brand_names bn on bn.key = x.brand_key
    ), '[]'::jsonb),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object('name', o.name, 'key', o.okey, 'values', o.vals) order by o.name collate "C")
      from (
        select k.okey, coalesce(onm.name, k.okey) as name,
               (select jsonb_agg(jsonb_build_object('value', coalesce(vn.name, v.vkey), 'key', v.vkey, 'count', v.n)
                                 order by v.n desc, coalesce(vn.name, v.vkey) collate "C")
                from (select split_part(t, ':', 2) as vkey, count(distinct p.id)::integer as n
                      from p cross join lateral unnest(p.tags) t
                      where split_part(t, ':', 1) = k.okey
                        and m_cat and m_brand and m_price and m_offers and m_stock
                        and public.shop_option_match(p.tags, v_opts, k.okey)
                      group by 1) v
                left join value_names vn on vn.okey = k.okey and vn.vkey = v.vkey) as vals
        from (select distinct split_part(t, ':', 1) as okey from p cross join lateral unnest(p.tags) t) k
        left join option_names onm on onm.okey = k.okey
      ) o
      where o.vals is not null
    ), '[]'::jsonb),
    'price', (
      select case when count(*) > 0 then jsonb_build_object('min', min(price), 'max', max(price)) end
      from p where m_cat and m_brand and m_offers and m_stock and public.shop_option_match(tags, v_opts)
    ),
    'offers', (
      select count(*)::integer from p
      where m_cat and m_brand and m_price and m_stock and public.shop_option_match(tags, v_opts) and compare_at_price is not null
    ),
    'in_stock', (
      select count(*)::integer from p
      where m_cat and m_brand and m_price and m_offers and in_stock and public.shop_option_match(option_tags_in_stock, v_opts)
    )
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.web_key(text) to anon, authenticated;
grant execute on function public.shop_option_match(text[], jsonb, text) to anon, authenticated;
grant execute on function public.shop_facets(jsonb) to anon, authenticated;
