-- ElMate · la tienda muestra primero los productos con foto.
-- Es aditivo: no borra datos. public_products suma has_images al final (misma definición que en
-- 20261119000000_tienda_filtros.sql, más esa columna); los permisos de la vista se conservan.

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
  tags.option_tags_in_stock,
  cardinality(p.images) > 0 as has_images
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
