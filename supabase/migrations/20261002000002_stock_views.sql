-- Vistas del panel de stock. Son security_invoker: aplican las políticas RLS de quien consulta,
-- así que "cost" llega NULL para un empleado (variant_costs es solo admin).

create view public.stock_overview with (security_invoker = true) as
select
  pv.id as variant_id,
  p.id as product_id,
  pv.sku,
  pv.barcode,
  pv.attributes,
  public.variant_label(pv.attributes, p.option_names) as variant_label,
  p.name as product_name,
  p.slug,
  p.category_id,
  c.name as category_name,
  p.supplier_id,
  s.name as supplier_name,
  coalesce(pv.image, p.images[1]) as image,
  pv.price,
  vc.cost,
  pv.stock,
  pv.min_stock,
  pv.low_stock,
  pv.active,
  p.is_visible,
  p.is_featured
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.categories c on c.id = p.category_id
left join public.suppliers s on s.id = p.supplier_id
left join public.variant_costs vc on vc.variant_id = pv.id
where p.archived_at is null;

create view public.stock_movement_log with (security_invoker = true) as
select
  m.id,
  m.created_at,
  m.type,
  m.quantity,
  m.stock_after,
  m.reason,
  m.sale_id,
  sa.ticket_number,
  m.variant_id,
  pv.sku,
  p.name as product_name,
  public.variant_label(pv.attributes, p.option_names) as variant_label,
  m.created_by,
  pr.full_name as created_by_name
from public.stock_movements m
join public.product_variants pv on pv.id = m.variant_id
join public.products p on p.id = pv.product_id
left join public.profiles pr on pr.id = m.created_by
left join public.sales sa on sa.id = m.sale_id;

grant select on public.stock_overview, public.stock_movement_log to authenticated;
