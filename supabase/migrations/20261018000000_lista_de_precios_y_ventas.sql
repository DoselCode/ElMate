-- ElMate · lista de precios del local, ventas y caja (Excel del dueño, octubre 2026).
-- Va encima de las migraciones ya aplicadas en la base real; no se editan las anteriores.
--
-- Cambios:
--  * Formas de pago configurables (tabla payment_methods) con su ajuste sobre el precio de lista:
--    efectivo -20 %, débito/transferencia/QR -15 %, 3 cuotas -10 %, 6 cuotas = lista.
--    Reemplazan al enum payment_method y a los recargos fijos de store_settings.
--  * Producto: marca, unidad de medida (unidad / kg) y si lleva control de stock (los grabados no).
--  * Costo + % de ganancia por variante (solo admin): el panel calcula el precio de lista con eso.
--  * Cantidades con decimales (yerba a granel por kg). Los productos por unidad siguen siendo enteros.
--  * Historial de ingresos mensuales importado del Excel (solo totales) y vistas para el panel de
--    caja, ventas e ingresos.

-- ---------------------------------------------------------------------------------------------
-- 1. Se sueltan las vistas y funciones que dependen de lo que cambia (se recrean más abajo)
-- ---------------------------------------------------------------------------------------------
drop view public.public_best_sellers;
drop view public.public_categories;
drop view public.public_variants;
drop view public.public_products;
drop view public.stock_overview;
drop view public.stock_movement_log;
drop view public.cash_session_summary;

drop function public.create_sale(uuid, public.payment_method, jsonb, numeric, text, text);
drop function public.register_stock_in(uuid, integer, numeric, text);
drop function public.adjust_stock(uuid, integer, text);
drop function public.count_stock(uuid, integer, text);

-- ---------------------------------------------------------------------------------------------
-- 2. Producto: marca, unidad y control de stock
-- ---------------------------------------------------------------------------------------------
alter table public.products
  add column brand text check (brand is null or char_length(brand) <= 80),
  add column unit text not null default 'unidad' check (unit in ('unidad', 'kg')),
  -- false = servicio o producto sin inventario (grabados): se vende sin mover stock
  add column track_stock boolean not null default true;

create index products_brand_idx on public.products (brand);

-- % de ganancia sobre el precio en efectivo (como en la lista del local). Solo admin, igual que el costo.
alter table public.variant_costs
  add column margin_pct numeric(5, 2) check (margin_pct is null or (margin_pct >= 0 and margin_pct < 100));

-- ---------------------------------------------------------------------------------------------
-- 3. Cantidades con decimales (kg). Los productos por unidad se validan enteros en el trigger.
-- ---------------------------------------------------------------------------------------------
alter table public.product_variants drop column low_stock;
alter table public.product_variants
  alter column stock type numeric(12, 3),
  alter column min_stock type numeric(12, 3);
alter table public.product_variants
  add column low_stock boolean generated always as (stock <= min_stock) stored;

alter table public.stock_movements
  alter column quantity type numeric(12, 3),
  alter column stock_after type numeric(12, 3);

alter table public.sale_items alter column quantity type numeric(12, 3);

-- ---------------------------------------------------------------------------------------------
-- 4. Formas de pago
-- ---------------------------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) >= 2),
  -- Sobre el precio de lista: -20 = 20 % de descuento, 10 = 10 % de recargo
  adjustment_pct numeric(5, 2) not null default 0 check (adjustment_pct between -100 and 100),
  -- Si suma al efectivo que tiene que haber en la caja al cerrar
  is_cash boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.payment_methods (name, adjustment_pct, is_cash, sort_order) values
  ('Efectivo', -20, true, 1),
  ('Transferencia', -15, false, 2),
  ('Débito', -15, false, 3),
  ('QR / Mercado Pago', -15, false, 4),
  ('Crédito 3 cuotas', -10, false, 5),
  ('Crédito 6 cuotas', 0, false, 6);

-- Las ventas guardan la forma de pago y una copia de su nombre y tipo (el historial no cambia
-- si después se renombra o se desactiva).
alter table public.sales
  add column payment_method_id uuid references public.payment_methods (id),
  add column payment_method_name text,
  add column payment_is_cash boolean;

update public.sales s set
  payment_method_id = pm.id, payment_method_name = pm.name, payment_is_cash = pm.is_cash
from public.payment_methods pm
where pm.name = case s.payment_method::text
  when 'efectivo' then 'Efectivo'
  when 'transferencia' then 'Transferencia'
  when 'tarjeta' then 'Crédito 6 cuotas'
  when 'mercadopago' then 'QR / Mercado Pago'
end;

alter table public.sales
  alter column payment_method_id set not null,
  alter column payment_method_name set not null,
  alter column payment_is_cash set not null,
  drop column payment_method;
alter table public.sales rename column surcharge_pct to adjustment_pct;
alter table public.sales rename column surcharge_amount to adjustment_amount;
create index sales_payment_method_idx on public.sales (payment_method_id);

alter table public.store_settings
  drop column surcharge_efectivo,
  drop column surcharge_transferencia,
  drop column surcharge_tarjeta,
  drop column surcharge_mercadopago;

drop type public.payment_method;

-- ---------------------------------------------------------------------------------------------
-- 5. Historial de ingresos (totales mensuales previos al sistema)
-- ---------------------------------------------------------------------------------------------
create table public.income_history (
  month date primary key check (month = date_trunc('month', month)::date),
  cash_amount numeric(14, 2) not null default 0 check (cash_amount >= 0),
  other_amount numeric(14, 2) not null default 0 check (other_amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- 6. RLS de las tablas nuevas
-- ---------------------------------------------------------------------------------------------
alter table public.payment_methods enable row level security;
alter table public.income_history enable row level security;

create policy payment_methods_select on public.payment_methods for select to authenticated using (public.is_staff());
create policy payment_methods_write on public.payment_methods for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy income_history_admin on public.income_history for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------------------------
-- 7. Funciones
-- ---------------------------------------------------------------------------------------------
-- Aplica cada movimiento al stock de la variante (única forma de cambiarlo).
create or replace function public.stock_movement_apply() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_stock numeric(12, 3);
  v_label text;
  v_unit text;
  v_track boolean;
begin
  select pv.stock, pr.name || coalesce(nullif(' - ' || public.variant_label(pv.attributes, pr.option_names), ' - '), ''),
         pr.unit, pr.track_stock
    into v_stock, v_label, v_unit, v_track
    from public.product_variants pv
    join public.products pr on pr.id = pv.product_id
   where pv.id = new.variant_id
     for update of pv;
  if not found then
    raise exception 'La variante no existe';
  end if;
  if not v_track then
    raise exception '"%" no lleva control de stock', v_label;
  end if;
  if v_unit = 'unidad' and new.quantity <> trunc(new.quantity) then
    raise exception 'Las cantidades de "%" son por unidad, sin decimales', v_label;
  end if;

  new.stock_after := v_stock + new.quantity;
  if new.stock_after < 0 then
    raise exception 'Stock insuficiente para "%": disponible %, solicitado %',
      v_label, trim_scale(v_stock), trim_scale(-new.quantity);
  end if;

  update public.product_variants set stock = new.stock_after where id = new.variant_id;
  return new;
end $$;

-- Alta o edición de un producto con todas sus variantes, en una sola transacción.
-- p = { id?, name, slug, description?, category_id?, supplier_id?, brand?, unit?, track_stock?,
--       option_names?[], images?[], is_visible?, badge?,
--       variants: [{ id?, sku, barcode?, attributes?, price, compare_at_price?, cost?, margin_pct?,
--                    min_stock?, image?, active?, initial_stock? }] }
-- Las variantes existentes que no vengan en la lista se desactivan (no se borran: tienen historial).
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
                                 option_names, images, is_visible, badge)
    values (
      p ->> 'name', p ->> 'slug', coalesce(p ->> 'description', ''),
      nullif(p ->> 'category_id', '')::uuid, nullif(p ->> 'supplier_id', '')::uuid,
      nullif(btrim(p ->> 'brand'), ''), coalesce(nullif(p ->> 'unit', ''), 'unidad'),
      coalesce((p ->> 'track_stock')::boolean, true),
      array(select jsonb_array_elements_text(p -> 'option_names')),
      array(select jsonb_array_elements_text(p -> 'images')),
      coalesce((p ->> 'is_visible')::boolean, true), nullif(p ->> 'badge', '')
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

-- Ingreso de mercadería. Si se informa costo, pasa a ser el costo actual de la variante.
create function public.register_stock_in(
  p_variant_id uuid, p_quantity numeric, p_unit_cost numeric default null, p_reason text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  perform public.require_admin();
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad tiene que ser mayor a cero';
  end if;
  insert into public.stock_movements (variant_id, type, quantity, reason)
  values (p_variant_id, 'ingreso', p_quantity, nullif(btrim(p_reason), ''))
  returning id into v_id;

  if p_unit_cost is not null then
    insert into public.variant_costs (variant_id, cost) values (p_variant_id, p_unit_cost)
    on conflict (variant_id) do update set cost = excluded.cost;
  end if;
  return v_id;
end $$;

-- Ajuste manual (diferencia de inventario, rotura, etc). p_delta con signo; motivo obligatorio.
create function public.adjust_stock(p_variant_id uuid, p_delta numeric, p_reason text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  perform public.require_admin();
  insert into public.stock_movements (variant_id, type, quantity, reason)
  values (p_variant_id, 'ajuste', p_delta, nullif(btrim(p_reason), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Recuento de inventario: se informa lo contado y se registra la diferencia como ajuste.
-- Devuelve la diferencia aplicada (0 si el stock ya coincidía; en ese caso no se registra nada).
create function public.count_stock(p_variant_id uuid, p_counted numeric, p_reason text default null)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_current numeric(12, 3);
  v_delta numeric(12, 3);
begin
  perform public.require_admin();
  if p_counted is null or p_counted < 0 then
    raise exception 'El stock contado no puede ser negativo';
  end if;

  select stock into v_current from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'La variante no existe';
  end if;

  v_delta := p_counted - v_current;
  if v_delta <> 0 then
    insert into public.stock_movements (variant_id, type, quantity, reason)
    values (p_variant_id, 'ajuste', v_delta,
            'Recuento (había ' || trim_scale(v_current) || ')' || coalesce(': ' || nullif(btrim(p_reason), ''), ''));
  end if;
  return v_delta;
end $$;

-- Venta. p_items = [{ variant_id, quantity }]: precio de lista de cada variante; la forma de pago
-- aplica su ajuste (descuento o recargo) sobre el total, después del descuento manual.
create function public.create_sale(
  p_session_id uuid,
  p_payment_method_id uuid,
  p_items jsonb,
  p_discount numeric default 0,
  p_customer text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.store_settings;
  v_pm public.payment_methods;
  v_sale_id uuid := gen_random_uuid();
  v_item jsonb;
  v_var record;
  v_qty numeric(12, 3);
  v_line numeric(12, 2);
  v_item_id uuid;
  v_subtotal numeric(12, 2) := 0;
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

    v_line := round(v_var.price * v_qty, 2);
    v_subtotal := v_subtotal + v_line;

    insert into public.sale_items (sale_id, variant_id, product_name, variant_label, sku, quantity, unit_price, line_total)
    values (v_sale_id, v_var.id, v_var.product_name, public.variant_label(v_var.attributes, v_var.option_names),
            v_var.sku, v_qty, v_var.price, v_line)
    returning id into v_item_id;

    insert into public.sale_item_costs (sale_item_id, unit_cost) values (v_item_id, v_var.cost);

    -- Los productos sin control de stock (grabados) se venden sin mover inventario
    if v_var.track_stock then
      insert into public.stock_movements (variant_id, type, quantity, sale_id)
      values (v_var.id, 'venta', -v_qty, v_sale_id);
    end if;
  end loop;

  if p_discount < 0 or p_discount > v_subtotal then
    raise exception 'El descuento no puede ser negativo ni mayor al subtotal';
  end if;

  v_base := v_subtotal - p_discount;
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
    subtotal = v_subtotal, discount_amount = p_discount, adjustment_pct = v_pm.adjustment_pct,
    adjustment_amount = v_adjustment, total = v_total, net_amount = v_net, vat_amount = v_vat
   where id = v_sale_id;

  return v_sale_id;
end $$;

-- Anular una venta devuelve el stock que esa venta descontó. Solo admin.
create or replace function public.void_sale(p_sale_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_mov record;
begin
  perform public.require_admin();
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Indicá el motivo de la anulación';
  end if;

  update public.sales set
    status = 'anulada', void_reason = btrim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = p_sale_id and status = 'pagada';
  if not found then
    raise exception 'La venta no existe o ya está anulada';
  end if;

  -- Solo se revierte lo que la venta movió (si el producto dejó de llevar stock, no hay qué devolver)
  for v_mov in
    select m.variant_id, m.quantity
      from public.stock_movements m
      join public.product_variants pv on pv.id = m.variant_id
      join public.products pr on pr.id = pv.product_id
     where m.sale_id = p_sale_id and m.type = 'venta' and pr.track_stock
  loop
    insert into public.stock_movements (variant_id, type, quantity, reason, sale_id)
    values (v_mov.variant_id, 'anulacion', -v_mov.quantity, 'Anulación de venta', p_sale_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Vistas del panel (security_invoker: aplican RLS de quien consulta)
-- ---------------------------------------------------------------------------------------------
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
  p.brand,
  p.unit,
  p.track_stock,
  p.category_id,
  c.name as category_name,
  p.supplier_id,
  s.name as supplier_name,
  coalesce(pv.image, p.images[1]) as image,
  pv.price,
  pv.compare_at_price,
  vc.cost,
  vc.margin_pct,
  pv.stock,
  pv.min_stock,
  (pv.low_stock and p.track_stock) as low_stock,
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
  p.unit,
  public.variant_label(pv.attributes, p.option_names) as variant_label,
  m.created_by,
  pr.full_name as created_by_name
from public.stock_movements m
join public.product_variants pv on pv.id = m.variant_id
join public.products p on p.id = pv.product_id
left join public.profiles pr on pr.id = m.created_by
left join public.sales sa on sa.id = m.sale_id;

-- Totales de una caja: lo usa el arqueo en vivo y el cierre.
create view public.cash_session_summary with (security_invoker = true) as
select
  s.id as session_id,
  s.register_id,
  s.status,
  s.opening_cash,
  s.opened_at,
  t.cash_sales,
  t.other_sales,
  t.sales_total,
  t.sales_count,
  m.cash_in,
  m.cash_out,
  s.opening_cash + t.cash_sales + m.cash_in - m.cash_out as expected_cash
from public.cash_sessions s
cross join lateral (
  select
    coalesce(sum(total) filter (where payment_is_cash), 0) as cash_sales,
    coalesce(sum(total) filter (where not payment_is_cash), 0) as other_sales,
    coalesce(sum(total), 0) as sales_total,
    count(*)::integer as sales_count
  from public.sales where session_id = s.id and status = 'pagada'
) t
cross join lateral (
  select
    coalesce(sum(amount) filter (where type = 'ingreso'), 0) as cash_in,
    coalesce(sum(amount) filter (where type = 'egreso'), 0) as cash_out
  from public.cash_movements where session_id = s.id
) m;

-- Ventas de cada caja por forma de pago (detalle del arqueo).
create view public.cash_session_by_method with (security_invoker = true) as
select session_id, payment_method_name, payment_is_cash, count(*)::integer as sales_count, sum(total) as total
from public.sales
where status = 'pagada'
group by session_id, payment_method_name, payment_is_cash;

-- Historial de ventas con vendedor y resumen de productos.
create view public.sales_log with (security_invoker = true) as
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
  items.summary
from public.sales s
left join public.profiles pr on pr.id = s.created_by
cross join lateral (
  select count(*)::integer as item_count,
         string_agg(i.product_name || coalesce(nullif(' (' || i.variant_label || ')', ' ()'), ''), ', ' order by i.product_name) as summary
  from public.sale_items i where i.sale_id = s.id
) items;

-- Ingresos por mes (hora argentina) y forma de pago, de las ventas pagadas del sistema.
create view public.income_by_month with (security_invoker = true) as
select
  date_trunc('month', s.created_at at time zone 'America/Argentina/Buenos_Aires')::date as month,
  s.payment_method_name,
  s.payment_is_cash,
  count(*)::integer as sales_count,
  sum(s.total) as total
from public.sales s
where s.status = 'pagada'
group by 1, 2, 3;

-- Ganancia por mes: total cobrado menos el costo congelado al vender. El costo es solo admin
-- (sale_item_costs), así que para un empleado llega null.
create view public.profit_by_month with (security_invoker = true) as
select month, sum(total) as revenue, sum(cost) as cost
from (
  select
    date_trunc('month', s.created_at at time zone 'America/Argentina/Buenos_Aires')::date as month,
    s.total,
    (select sum(c.unit_cost * i.quantity)
       from public.sale_items i
       join public.sale_item_costs c on c.sale_item_id = i.id
      where i.sale_id = s.id) as cost
  from public.sales s
  where s.status = 'pagada'
) x
group by month;

-- ---------------------------------------------------------------------------------------------
-- 9. Vistas públicas: igual que antes + marca y unidad; los productos sin control de stock
--    siempre están disponibles.
-- ---------------------------------------------------------------------------------------------
create view public.public_products as
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
  where product_id = p.id and active
  order by price, created_at
  limit 1
) cheapest
cross join lateral (
  select count(*)::integer as variant_count,
         count(distinct price) > 1 as has_price_range,
         coalesce(bool_or(stock > 0 or not p.track_stock), false) as in_stock
  from public.product_variants where product_id = p.id and active
) stats
where p.is_visible and p.archived_at is null;

create view public.public_variants as
select pv.id, pv.product_id, pv.attributes, public.variant_label(pv.attributes, p.option_names) as label,
       pv.price, pv.compare_at_price, pv.image, (pv.stock > 0 or not p.track_stock) as in_stock
from public.product_variants pv
join public.products p on p.id = pv.product_id
where pv.active and p.is_visible and p.archived_at is null;

create view public.public_categories as
select c.id, c.name, c.slug, c.image, c.sort_order,
       (select count(*)::integer from public.public_products pp where pp.category_slug = c.slug) as product_count
from public.categories c;

create view public.public_best_sellers as
select pv.product_id, row_number() over (order by sum(si.quantity) desc, pv.product_id)::integer as rank
from public.sale_items si
join public.sales s on s.id = si.sale_id and s.status = 'pagada' and s.created_at > now() - interval '90 days'
join public.product_variants pv on pv.id = si.variant_id
where exists (select 1 from public.public_products pp where pp.id = pv.product_id)
group by pv.product_id
order by rank
limit 12;

-- Formas de pago con su ajuste, para mostrar en la web "en efectivo $X".
create view public.public_payment_methods as
select name, adjustment_pct, is_cash, sort_order
from public.payment_methods
where active;

-- ---------------------------------------------------------------------------------------------
-- 10. Privilegios: lo nuevo arranca sin permisos (ver core_schema); se concede explícito.
-- ---------------------------------------------------------------------------------------------
revoke all on public.payment_methods, public.income_history, public.stock_overview,
  public.stock_movement_log, public.cash_session_summary, public.cash_session_by_method,
  public.sales_log, public.income_by_month, public.profit_by_month, public.public_products,
  public.public_variants, public.public_categories, public.public_best_sellers,
  public.public_payment_methods from anon, authenticated;

grant select on public.payment_methods, public.income_history, public.stock_overview,
  public.stock_movement_log, public.cash_session_summary, public.cash_session_by_method,
  public.sales_log, public.income_by_month, public.profit_by_month to authenticated;
grant insert, update, delete on public.payment_methods, public.income_history to authenticated;

grant select on public.public_products, public.public_variants, public.public_categories,
  public.public_best_sellers, public.public_payment_methods to anon, authenticated;

revoke execute on function
  public.register_stock_in(uuid, numeric, numeric, text), public.adjust_stock(uuid, numeric, text),
  public.count_stock(uuid, numeric, text), public.create_sale(uuid, uuid, jsonb, numeric, text, text)
  from public, anon, authenticated;
grant execute on function
  public.register_stock_in(uuid, numeric, numeric, text), public.adjust_stock(uuid, numeric, text),
  public.count_stock(uuid, numeric, text), public.create_sale(uuid, uuid, jsonb, numeric, text, text)
  to authenticated;
