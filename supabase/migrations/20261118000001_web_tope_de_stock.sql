-- ElMate · tope de cantidad en la web según el stock real.
-- Es aditivo: no borra datos. public_variants suma max_quantity (al final, los permisos se conservan):
--   * null  = el producto no lleva control de stock (servicios como grabados): sin tope propio.
--   * 0..99 = cuánto se puede sumar al carrito. Se toma el stock entero (si es por kg y queda menos de
--     1 kg, 1) y se corta en 99, el máximo del carrito: así un stock grande no se publica exacto.

create or replace view public.public_variants as
select pv.id, pv.product_id, pv.attributes, public.variant_label(pv.attributes, p.option_names) as label,
       (case when lp.promo_price < pv.price then lp.promo_price else pv.price end)::numeric(12, 2) as price,
       (case when lp.promo_price < pv.price then pv.price else pv.compare_at_price end)::numeric(12, 2) as compare_at_price,
       pv.image, (pv.stock > 0 or not p.track_stock) as in_stock,
       (case when not p.track_stock then null
             else least(greatest(floor(pv.stock), case when pv.stock > 0 then 1 else 0 end), 99) end)::integer as max_quantity
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.live_promo_prices lp on lp.variant_id = pv.id
where pv.active and pv.price > 0 and p.is_visible and p.archived_at is null;
