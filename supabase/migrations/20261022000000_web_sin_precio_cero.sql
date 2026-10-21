-- ElMate · la web no muestra nada a $0.
-- Las variantes sin precio cargado (0) no se publican, y un producto que no tiene ninguna variante
-- con precio no aparece en la web aunque esté marcado como visible. En el panel se siguen viendo.
-- Mismas columnas que en 20261018000000 (create or replace conserva los permisos).

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
  stats.in_stock
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

create or replace view public.public_variants as
select pv.id, pv.product_id, pv.attributes, public.variant_label(pv.attributes, p.option_names) as label,
       pv.price, pv.compare_at_price, pv.image, (pv.stock > 0 or not p.track_stock) as in_stock
from public.product_variants pv
join public.products p on p.id = pv.product_id
where pv.active and pv.price > 0 and p.is_visible and p.archived_at is null;
