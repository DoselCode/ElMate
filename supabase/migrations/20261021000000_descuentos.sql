-- ElMate · descuentos al vender (presupuesto Stock, Módulo 3): por producto y sobre el total,
-- cada uno en porcentaje o en monto fijo. Va encima de las migraciones ya aplicadas.

-- Descuento de cada línea: monto aplicado y, si se cargó en %, el porcentaje (para el ticket).
alter table public.sale_items
  add column discount_pct numeric(5, 2) check (discount_pct is null or (discount_pct > 0 and discount_pct <= 100)),
  add column discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0);

-- Descuento general: sales.discount_amount ya guarda el monto; se suma el % si se cargó así.
alter table public.sales
  add column discount_pct numeric(5, 2) check (discount_pct is null or (discount_pct > 0 and discount_pct <= 100));

drop function public.create_sale(uuid, uuid, jsonb, numeric, text, text);

-- Venta. p_items = [{ variant_id, quantity, discount_pct?, discount_amount? }]:
--   cada línea = precio de lista × cantidad − su descuento (en % o en $, no los dos).
-- Después se aplica el descuento general (p_discount: monto, o % si p_discount_is_pct) y por último
-- el ajuste de la forma de pago (descuento o recargo) sobre lo que queda.
create function public.create_sale(
  p_session_id uuid,
  p_payment_method_id uuid,
  p_items jsonb,
  p_discount numeric default 0,
  p_customer text default null,
  p_notes text default null,
  p_discount_is_pct boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.store_settings;
  v_pm public.payment_methods;
  v_sale_id uuid := gen_random_uuid();
  v_item jsonb;
  v_var record;
  v_qty numeric(12, 3);
  v_gross numeric(12, 2);
  v_line_pct numeric(5, 2);
  v_line_discount numeric(12, 2);
  v_line numeric(12, 2);
  v_item_id uuid;
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2);
  v_base numeric(12, 2);
  v_adjustment numeric(12, 2);
  v_total numeric(12, 2);
  v_net numeric(12, 2);
  v_vat numeric(12, 2);
begin
  perform public.require_staff();

  if not exists (select 1 from public.cash_sessions where id = p_session_id and status = 'abierta') then
    raise exception 'La caja no está abierta';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  select * into v_pm from public.payment_methods where id = p_payment_method_id and active;
  if not found then
    raise exception 'Elegí una forma de pago válida';
  end if;

  select * into v_cfg from public.store_settings where id = 1;

  insert into public.sales (id, session_id, customer_name, payment_method_id, payment_method_name, payment_is_cash, notes)
  values (v_sale_id, p_session_id, nullif(btrim(p_customer), ''), v_pm.id, v_pm.name, v_pm.is_cash, nullif(btrim(p_notes), ''));

  for v_item in select e from jsonb_array_elements(p_items) e loop
    v_qty := (v_item ->> 'quantity')::numeric;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    select pv.id, pv.sku, pv.price, pv.active, pv.attributes,
           pr.name as product_name, pr.option_names, pr.archived_at, pr.unit, pr.track_stock,
           coalesce(vc.cost, 0) as cost
      into v_var
      from public.product_variants pv
      join public.products pr on pr.id = pv.product_id
      left join public.variant_costs vc on vc.variant_id = pv.id
     where pv.id = (v_item ->> 'variant_id')::uuid;

    if not found or not v_var.active or v_var.archived_at is not null then
      raise exception 'Hay un producto que ya no está disponible';
    end if;
    if v_var.unit = 'unidad' and v_qty <> trunc(v_qty) then
      raise exception 'Las cantidades de "%" son por unidad, sin decimales', v_var.product_name;
    end if;

    v_gross := round(v_var.price * v_qty, 2);

    -- Descuento de la línea: en % o en monto, nunca más que la línea
    v_line_pct := nullif((v_item ->> 'discount_pct')::numeric, 0);
    if v_line_pct is not null and (v_item ->> 'discount_amount') is not null and (v_item ->> 'discount_amount')::numeric <> 0 then
      raise exception 'Cada producto lleva un descuento en %% o en monto, no los dos';
    end if;
    if v_line_pct is not null then
      if v_line_pct < 0 or v_line_pct > 100 then
        raise exception 'El descuento de "%" tiene que estar entre 0 y 100 %%', v_var.product_name;
      end if;
      v_line_discount := round(v_gross * v_line_pct / 100, 2);
    else
      v_line_discount := coalesce((v_item ->> 'discount_amount')::numeric, 0);
      if v_line_discount < 0 or v_line_discount > v_gross then
        raise exception 'El descuento de "%" no puede ser negativo ni mayor al importe del producto', v_var.product_name;
      end if;
    end if;

    v_line := v_gross - v_line_discount;
    v_subtotal := v_subtotal + v_line;

    insert into public.sale_items (sale_id, variant_id, product_name, variant_label, sku, quantity, unit_price,
                                   discount_pct, discount_amount, line_total)
    values (v_sale_id, v_var.id, v_var.product_name, public.variant_label(v_var.attributes, v_var.option_names),
            v_var.sku, v_qty, v_var.price, v_line_pct, v_line_discount, v_line)
    returning id into v_item_id;

    insert into public.sale_item_costs (sale_item_id, unit_cost) values (v_item_id, v_var.cost);

    -- Los productos sin control de stock (grabados) se venden sin mover inventario
    if v_var.track_stock then
      insert into public.stock_movements (variant_id, type, quantity, sale_id)
      values (v_var.id, 'venta', -v_qty, v_sale_id);
    end if;
  end loop;

  -- Descuento general, sobre el subtotal ya descontado por línea
  if p_discount is null or p_discount < 0 then
    raise exception 'El descuento no puede ser negativo';
  end if;
  if p_discount_is_pct then
    if p_discount > 100 then
      raise exception 'El descuento tiene que estar entre 0 y 100 %%';
    end if;
    v_discount := round(v_subtotal * p_discount / 100, 2);
  else
    if p_discount > v_subtotal then
      raise exception 'El descuento no puede ser negativo ni mayor al subtotal';
    end if;
    v_discount := p_discount;
  end if;

  v_base := v_subtotal - v_discount;
  v_adjustment := round(v_base * v_pm.adjustment_pct / 100, 2);
  v_total := v_base + v_adjustment;

  if v_cfg.show_vat then
    v_net := round(v_total / (1 + v_cfg.vat_rate / 100), 2);
    v_vat := v_total - v_net;
  else
    v_net := v_total;
    v_vat := 0;
  end if;

  update public.sales set
    subtotal = v_subtotal, discount_amount = v_discount,
    discount_pct = case when p_discount_is_pct and p_discount > 0 then p_discount end,
    adjustment_pct = v_pm.adjustment_pct, adjustment_amount = v_adjustment,
    total = v_total, net_amount = v_net, vat_amount = v_vat
   where id = v_sale_id;

  return v_sale_id;
end $$;

revoke execute on function public.create_sale(uuid, uuid, jsonb, numeric, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_sale(uuid, uuid, jsonb, numeric, text, text, boolean) to authenticated;

-- El historial de ventas suma el % del descuento general (columna nueva al final de la vista).
create or replace view public.sales_log with (security_invoker = true) as
select
  s.id,
  s.ticket_number,
  s.created_at,
  s.session_id,
  s.customer_name,
  s.payment_method_name,
  s.payment_is_cash,
  s.subtotal,
  s.discount_amount,
  s.adjustment_pct,
  s.adjustment_amount,
  s.total,
  s.status,
  s.notes,
  s.void_reason,
  s.created_by,
  pr.full_name as seller_name,
  items.item_count,
  items.summary,
  s.discount_pct
from public.sales s
left join public.profiles pr on pr.id = s.created_by
cross join lateral (
  select count(*)::integer as item_count,
         string_agg(i.product_name || coalesce(nullif(' (' || i.variant_label || ')', ' ()'), ''), ', ' order by i.product_name) as summary
  from public.sale_items i where i.sale_id = s.id
) items;
