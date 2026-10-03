-- ElMate · modelo de datos base
--
-- Principios:
--  * Un producto SIEMPRE tiene al menos una variante; precio, SKU y stock viven en la variante.
--  * El stock se mueve solo con stock_movements (inmutable). product_variants.stock es una caché
--    mantenida por trigger; ningún rol de la API puede escribirla directamente.
--  * Costos y ganancias son solo para admin (tablas aparte con RLS).
--  * Las escrituras sensibles (ventas, stock, caja, guardar producto) pasan por funciones SQL
--    transaccionales; las tablas no exponen INSERT/UPDATE directo para esas operaciones.
--  * Los precios de la web pública se exponen por vistas (public_*), nunca por las tablas.

-- ---------------------------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'empleado');
create type public.stock_movement_type as enum ('ingreso', 'venta', 'ajuste', 'anulacion');
create type public.payment_method as enum ('efectivo', 'transferencia', 'tarjeta', 'mercadopago');
create type public.sale_status as enum ('pagada', 'anulada');
create type public.cash_session_status as enum ('abierta', 'cerrada');
create type public.cash_movement_type as enum ('ingreso', 'egreso');

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Usuarios y roles
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'empleado',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;

-- El primer usuario creado es admin; el resto entra como empleado.
-- Requiere tener DESACTIVADO el registro público en Supabase Auth (los usuarios los crea el admin).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when exists (select 1 from public.profiles) then 'empleado'::public.app_role
         else 'admin'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Configuración del local (una sola fila)
-- ---------------------------------------------------------------------------------------------
create table public.store_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default 'El Mate',
  tagline text,
  logo text,
  phone text,
  whatsapp_number text,
  email text,
  address text,
  instagram_url text,
  hours_weekdays text,
  hours_saturday text,
  hours_sunday text,
  -- Ticket (no válido como factura)
  legal_name text,
  cuit text,
  tax_condition text,
  point_of_sale integer not null default 1,
  show_vat boolean not null default false,
  vat_rate numeric(5, 2) not null default 21 check (vat_rate >= 0),
  -- Recargo (+) o descuento (-) en % según método de pago, sobre el precio de lista
  surcharge_efectivo numeric(5, 2) not null default 0 check (surcharge_efectivo between -100 and 1000),
  surcharge_transferencia numeric(5, 2) not null default 0 check (surcharge_transferencia between -100 and 1000),
  surcharge_tarjeta numeric(5, 2) not null default 0 check (surcharge_tarjeta between -100 and 1000),
  surcharge_mercadopago numeric(5, 2) not null default 0 check (surcharge_mercadopago between -100 and 1000),
  updated_at timestamptz not null default now()
);
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();
insert into public.store_settings (id) values (1);

-- ---------------------------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) >= 2),
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) >= 2),
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 150),
  slug text not null unique,
  description text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  -- Ejes de variación, en orden de visualización. Ej: {Color,Tamaño}
  option_names text[] not null default '{}',
  images text[] not null default '{}',
  is_visible boolean not null default true,
  is_featured boolean not null default false,
  badge text check (char_length(badge) <= 50),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_single_featured on public.products (is_featured) where is_featured;
create index products_category_idx on public.products (category_id);
create index products_supplier_idx on public.products (supplier_id);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (sku = btrim(sku) and sku <> ''),
  barcode text unique,
  -- Valores por eje. Ej: {"Color": "Rojo", "Tamaño": "Grande"}; producto sin variantes: {}
  attributes jsonb not null default '{}' check (jsonb_typeof(attributes) = 'object'),
  price numeric(12, 2) not null check (price >= 0),
  -- Solo la modifica el trigger de stock_movements
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  low_stock boolean generated always as (stock <= min_stock) stored,
  image text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, attributes)
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Costo actual por variante. Tabla aparte para que el empleado no pueda leerlo.
create table public.variant_costs (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  updated_at timestamptz not null default now()
);
create trigger variant_costs_updated_at before update on public.variant_costs
  for each row execute function public.set_updated_at();

create function public.variant_label(attrs jsonb, names text[]) returns text
language sql immutable as $$
  select coalesce(
    nullif((select string_agg(attrs ->> n, ' / ' order by ord)
              from unnest(names) with ordinality as t(n, ord)
             where attrs ? n), ''),
    nullif((select string_agg(value, ' / ' order by key) from jsonb_each_text(attrs)), ''),
    ''
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Caja
-- ---------------------------------------------------------------------------------------------
create table public.registers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true
);
insert into public.registers (name) values ('Caja principal');

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  register_id uuid not null references public.registers (id),
  status public.cash_session_status not null default 'abierta',
  opening_cash numeric(12, 2) not null check (opening_cash >= 0),
  opened_by uuid references public.profiles (id) default auth.uid(),
  opened_at timestamptz not null default now(),
  -- Cierre (arqueo)
  expected_cash numeric(12, 2),
  counted_cash numeric(12, 2) check (counted_cash >= 0),
  difference numeric(12, 2),
  -- Efectivo que queda en la caja; se propone como monto inicial de la próxima apertura
  cash_left numeric(12, 2) check (cash_left >= 0),
  closed_by uuid references public.profiles (id),
  closed_at timestamptz,
  notes text,
  check ((status = 'abierta') = (closed_at is null))
);
create unique index cash_sessions_one_open_per_register
  on public.cash_sessions (register_id) where status = 'abierta';
create index cash_sessions_opened_at_idx on public.cash_sessions (opened_at desc);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions (id),
  type public.cash_movement_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null check (char_length(btrim(reason)) > 0),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index cash_movements_session_idx on public.cash_movements (session_id);

-- ---------------------------------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------------------------------
create sequence public.ticket_number_seq;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint not null unique default nextval('public.ticket_number_seq'),
  session_id uuid not null references public.cash_sessions (id),
  customer_name text,
  payment_method public.payment_method not null,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  surcharge_pct numeric(5, 2) not null default 0,
  surcharge_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0 check (total >= 0),
  net_amount numeric(12, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  status public.sale_status not null default 'pagada',
  notes text,
  void_reason text,
  voided_by uuid references public.profiles (id),
  voided_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check ((status = 'anulada') = (voided_at is not null))
);
create index sales_session_idx on public.sales (session_id);
create index sales_created_at_idx on public.sales (created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id),
  -- Snapshots: el historial no cambia si luego se edita el producto
  product_name text not null,
  variant_label text not null default '',
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_variant_idx on public.sale_items (variant_id);

-- Costo unitario congelado al vender (para la ganancia). Solo admin.
create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id) on delete cascade,
  unit_cost numeric(12, 2) not null check (unit_cost >= 0)
);

-- ---------------------------------------------------------------------------------------------
-- Movimientos de stock (inmutables)
-- ---------------------------------------------------------------------------------------------
create table public.stock_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id),
  type public.stock_movement_type not null,
  -- Con signo: positivo suma, negativo resta
  quantity integer not null check (quantity <> 0),
  stock_after integer not null default 0,
  reason text,
  sale_id uuid references public.sales (id),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint stock_movements_sign check (
    (type = 'ingreso' and quantity > 0)
    or (type = 'venta' and quantity < 0)
    or (type = 'anulacion' and quantity > 0)
    or type = 'ajuste'
  ),
  constraint stock_movements_adjust_reason check (
    type <> 'ajuste' or char_length(btrim(coalesce(reason, ''))) > 0
  )
);
create index stock_movements_variant_idx on public.stock_movements (variant_id, created_at desc);
create index stock_movements_created_at_idx on public.stock_movements (created_at desc);
create index stock_movements_sale_idx on public.stock_movements (sale_id);

create function public.stock_movement_apply() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_stock integer;
  v_label text;
begin
  select pv.stock, pr.name || coalesce(nullif(' - ' || public.variant_label(pv.attributes, pr.option_names), ' - '), '')
    into v_stock, v_label
    from public.product_variants pv
    join public.products pr on pr.id = pv.product_id
   where pv.id = new.variant_id
     for update of pv;
  if not found then
    raise exception 'La variante no existe';
  end if;

  new.stock_after := v_stock + new.quantity;
  if new.stock_after < 0 then
    raise exception 'Stock insuficiente para "%": disponible %, solicitado %', v_label, v_stock, -new.quantity;
  end if;

  update public.product_variants set stock = new.stock_after where id = new.variant_id;
  return new;
end $$;

create trigger stock_movements_apply before insert on public.stock_movements
  for each row execute function public.stock_movement_apply();

create function public.stock_movements_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Los movimientos de stock no se pueden modificar ni borrar; registrá un ajuste';
end $$;

create trigger stock_movements_no_change before update or delete on public.stock_movements
  for each row execute function public.stock_movements_immutable();

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_costs enable row level security;
alter table public.registers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_item_costs enable row level security;
alter table public.stock_movements enable row level security;

-- Todo el personal ve nombres y roles (para mostrar quién hizo cada movimiento o venta).
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy store_settings_select on public.store_settings for select to authenticated
  using (public.is_staff());
create policy store_settings_update on public.store_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy categories_select on public.categories for select to authenticated using (public.is_staff());
create policy categories_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy suppliers_select on public.suppliers for select to authenticated using (public.is_staff());
create policy suppliers_write on public.suppliers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products for select to authenticated using (public.is_staff());
create policy products_update on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy variants_select on public.product_variants for select to authenticated using (public.is_staff());

create policy variant_costs_admin on public.variant_costs for select to authenticated using (public.is_admin());

create policy registers_select on public.registers for select to authenticated using (public.is_staff());
create policy registers_write on public.registers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy cash_sessions_select on public.cash_sessions for select to authenticated using (public.is_staff());
create policy cash_movements_select on public.cash_movements for select to authenticated using (public.is_staff());
create policy sales_select on public.sales for select to authenticated using (public.is_staff());
create policy sale_items_select on public.sale_items for select to authenticated using (public.is_staff());
create policy sale_item_costs_admin on public.sale_item_costs for select to authenticated using (public.is_admin());
create policy stock_movements_select on public.stock_movements for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------------------------
-- Funciones de negocio
-- ---------------------------------------------------------------------------------------------
create function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
end $$;

create function public.require_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
end $$;

-- Código automático para variantes cargadas sin SKU: EM-00001, EM-00002...
create sequence public.sku_seq;

create function public.next_sku() returns text
language sql security definer set search_path = public as $$
  select 'EM-' || lpad(nextval('public.sku_seq')::text, 5, '0');
$$;

-- Alta o edición de un producto con todas sus variantes, en una sola transacción.
-- p = { id?, name, slug, description?, category_id?, supplier_id?, option_names?[], images?[],
--       is_visible?, badge?, variants: [{ id?, sku, barcode?, attributes?, price, cost?, min_stock?,
--       image?, active?, initial_stock? }] }
-- Las variantes existentes que no vengan en la lista se desactivan (no se borran: tienen historial).
create function public.save_product(p jsonb) returns uuid
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
      insert into public.product_variants (product_id, sku, barcode, attributes, price, min_stock, image, active)
      values (
        v_id, upper(coalesce(nullif(btrim(v ->> 'sku'), ''), public.next_sku())),
        nullif(btrim(v ->> 'barcode'), ''), coalesce(v -> 'attributes', '{}'::jsonb),
        (v ->> 'price')::numeric, coalesce((v ->> 'min_stock')::integer, 0),
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

-- Destacado único: pasar null para quitar el destacado actual.
create function public.set_featured_product(p_product_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.products set is_featured = false where is_featured;
  if p_product_id is not null then
    update public.products set is_featured = true where id = p_product_id and archived_at is null;
    if not found then
      raise exception 'El producto no existe o está archivado';
    end if;
  end if;
end $$;

-- Ingreso de mercadería. Si se informa costo, pasa a ser el costo actual de la variante.
create function public.register_stock_in(
  p_variant_id uuid, p_quantity integer, p_unit_cost numeric default null, p_reason text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
begin
  perform public.require_admin();
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
create function public.adjust_stock(p_variant_id uuid, p_delta integer, p_reason text) returns bigint
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
create function public.count_stock(p_variant_id uuid, p_counted integer, p_reason text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_current integer;
  v_delta integer;
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
            'Recuento (había ' || v_current || ')' || coalesce(': ' || nullif(btrim(p_reason), ''), ''));
  end if;
  return v_delta;
end $$;

-- Caja ----------------------------------------------------------------------------------------
create function public.open_cash_session(p_register_id uuid, p_opening_cash numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform public.require_staff();
  if exists (select 1 from public.cash_sessions where register_id = p_register_id and status = 'abierta') then
    raise exception 'La caja ya está abierta';
  end if;
  insert into public.cash_sessions (register_id, opening_cash)
  values (p_register_id, p_opening_cash) returning id into v_id;
  return v_id;
end $$;

create function public.add_cash_movement(
  p_session_id uuid, p_type public.cash_movement_type, p_amount numeric, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform public.require_staff();
  if not exists (select 1 from public.cash_sessions where id = p_session_id and status = 'abierta') then
    raise exception 'La caja no está abierta';
  end if;
  insert into public.cash_movements (session_id, type, amount, reason)
  values (p_session_id, p_type, p_amount, p_reason) returning id into v_id;
  return v_id;
end $$;

-- Totales por sesión: lo usa el arqueo en vivo y el cierre.
create view public.cash_session_summary with (security_invoker = true) as
select
  s.id as session_id,
  s.register_id,
  s.status,
  s.opening_cash,
  t.cash_sales,
  t.transfer_sales,
  t.card_sales,
  t.mercadopago_sales,
  t.sales_count,
  m.cash_in,
  m.cash_out,
  s.opening_cash + t.cash_sales + m.cash_in - m.cash_out as expected_cash
from public.cash_sessions s
cross join lateral (
  select
    coalesce(sum(total) filter (where payment_method = 'efectivo'), 0) as cash_sales,
    coalesce(sum(total) filter (where payment_method = 'transferencia'), 0) as transfer_sales,
    coalesce(sum(total) filter (where payment_method = 'tarjeta'), 0) as card_sales,
    coalesce(sum(total) filter (where payment_method = 'mercadopago'), 0) as mercadopago_sales,
    count(*) as sales_count
  from public.sales where session_id = s.id and status = 'pagada'
) t
cross join lateral (
  select
    coalesce(sum(amount) filter (where type = 'ingreso'), 0) as cash_in,
    coalesce(sum(amount) filter (where type = 'egreso'), 0) as cash_out
  from public.cash_movements where session_id = s.id
) m;

create function public.close_cash_session(
  p_session_id uuid, p_counted_cash numeric, p_cash_left numeric default 0, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_expected numeric(12, 2);
begin
  perform public.require_staff();
  if p_cash_left > p_counted_cash then
    raise exception 'El efectivo que queda en caja no puede superar al contado';
  end if;

  select expected_cash into v_expected from public.cash_session_summary
   where session_id = p_session_id and status = 'abierta';
  if not found then
    raise exception 'La caja no está abierta';
  end if;

  update public.cash_sessions set
    status = 'cerrada', expected_cash = v_expected, counted_cash = p_counted_cash,
    difference = p_counted_cash - v_expected, cash_left = p_cash_left,
    closed_by = auth.uid(), closed_at = now(), notes = nullif(btrim(p_notes), '')
   where id = p_session_id;
  return p_session_id;
end $$;

-- Ventas --------------------------------------------------------------------------------------
-- p_items = [{ variant_id, quantity }]. Precio de lista de la variante + recargo según método.
create function public.create_sale(
  p_session_id uuid,
  p_payment_method public.payment_method,
  p_items jsonb,
  p_discount numeric default 0,
  p_customer text default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_cfg public.store_settings;
  v_sale_id uuid := gen_random_uuid();
  v_item jsonb;
  v_var record;
  v_qty integer;
  v_line numeric(12, 2);
  v_item_id uuid;
  v_subtotal numeric(12, 2) := 0;
  v_pct numeric(5, 2);
  v_base numeric(12, 2);
  v_surcharge numeric(12, 2);
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

  select * into v_cfg from public.store_settings where id = 1;

  insert into public.sales (id, session_id, customer_name, payment_method, notes)
  values (v_sale_id, p_session_id, nullif(btrim(p_customer), ''), p_payment_method, nullif(btrim(p_notes), ''));

  for v_item in select e from jsonb_array_elements(p_items) e loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    select pv.id, pv.sku, pv.price, pv.active, pv.attributes,
           pr.name as product_name, pr.option_names, pr.archived_at,
           coalesce(vc.cost, 0) as cost
      into v_var
      from public.product_variants pv
      join public.products pr on pr.id = pv.product_id
      left join public.variant_costs vc on vc.variant_id = pv.id
     where pv.id = (v_item ->> 'variant_id')::uuid;

    if not found or not v_var.active or v_var.archived_at is not null then
      raise exception 'Hay un producto que ya no está disponible';
    end if;

    v_line := v_var.price * v_qty;
    v_subtotal := v_subtotal + v_line;

    insert into public.sale_items (sale_id, variant_id, product_name, variant_label, sku, quantity, unit_price, line_total)
    values (v_sale_id, v_var.id, v_var.product_name, public.variant_label(v_var.attributes, v_var.option_names),
            v_var.sku, v_qty, v_var.price, v_line)
    returning id into v_item_id;

    insert into public.sale_item_costs (sale_item_id, unit_cost) values (v_item_id, v_var.cost);

    insert into public.stock_movements (variant_id, type, quantity, sale_id)
    values (v_var.id, 'venta', -v_qty, v_sale_id);
  end loop;

  if p_discount < 0 or p_discount > v_subtotal then
    raise exception 'El descuento no puede ser negativo ni mayor al subtotal';
  end if;

  v_pct := case p_payment_method
    when 'efectivo' then v_cfg.surcharge_efectivo
    when 'transferencia' then v_cfg.surcharge_transferencia
    when 'tarjeta' then v_cfg.surcharge_tarjeta
    when 'mercadopago' then v_cfg.surcharge_mercadopago
  end;
  v_base := v_subtotal - p_discount;
  v_surcharge := round(v_base * v_pct / 100, 2);
  v_total := v_base + v_surcharge;

  if v_cfg.show_vat then
    v_net := round(v_total / (1 + v_cfg.vat_rate / 100), 2);
    v_vat := v_total - v_net;
  else
    v_net := v_total;
    v_vat := 0;
  end if;

  update public.sales set
    subtotal = v_subtotal, discount_amount = p_discount, surcharge_pct = v_pct,
    surcharge_amount = v_surcharge, total = v_total, net_amount = v_net, vat_amount = v_vat
   where id = v_sale_id;

  return v_sale_id;
end $$;

-- Anular una venta devuelve el stock. Solo admin.
create function public.void_sale(p_sale_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item record;
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

  for v_item in select variant_id, quantity from public.sale_items where sale_id = p_sale_id loop
    insert into public.stock_movements (variant_id, type, quantity, reason, sale_id)
    values (v_item.variant_id, 'anulacion', v_item.quantity, 'Anulación de venta', p_sale_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Vistas públicas (landing / catálogo): sin costos, sin cantidades exactas de stock
-- ---------------------------------------------------------------------------------------------
create view public.public_categories as
select id, name, slug, sort_order from public.categories;

create view public.public_products as
select
  p.id, p.name, p.slug, p.description, p.images, p.badge, p.is_featured, p.option_names,
  c.name as category_name, c.slug as category_slug,
  v.price_from,
  v.in_stock
from public.products p
left join public.categories c on c.id = p.category_id
cross join lateral (
  select min(price) as price_from, coalesce(bool_or(stock > 0), false) as in_stock
  from public.product_variants where product_id = p.id and active
) v
where p.is_visible and p.archived_at is null and v.price_from is not null;

create view public.public_variants as
select pv.id, pv.product_id, pv.attributes, pv.price, pv.image, (pv.stock > 0) as in_stock
from public.product_variants pv
join public.products p on p.id = pv.product_id
where pv.active and p.is_visible and p.archived_at is null;

create view public.public_store_info as
select name, tagline, logo, phone, whatsapp_number, email, address, instagram_url,
       hours_weekdays, hours_saturday, hours_sunday
from public.store_settings;

-- ---------------------------------------------------------------------------------------------
-- Privilegios
-- Supabase otorga ALL a anon/authenticated sobre todo lo que se crea en public (también vistas,
-- que si son simples aceptarían INSERT/UPDATE con los permisos del dueño). Se revoca todo y se
-- concede solo lo necesario. Va al final para cubrir también vistas y funciones.
-- ---------------------------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Lo que se cree en migraciones futuras arranca sin permisos: hay que conceder de forma explícita.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Panel (staff). Las filas visibles las decide RLS; los costos solo se ven siendo admin.
grant select on public.profiles, public.store_settings, public.categories, public.suppliers,
  public.products, public.product_variants, public.variant_costs, public.registers,
  public.cash_sessions, public.cash_movements, public.sales, public.sale_items,
  public.sale_item_costs, public.stock_movements, public.cash_session_summary to authenticated;

grant update (full_name, role, active) on public.profiles to authenticated;
grant update on public.store_settings to authenticated;
grant insert, update, delete on public.categories, public.suppliers, public.registers to authenticated;
-- Alta/edición de productos: save_product(). Acá solo los interruptores simples.
grant update (is_visible, archived_at) on public.products to authenticated;

-- Funciones: cada una valida el rol adentro. is_staff/is_admin también las evalúan las políticas RLS.
grant execute on function
  public.is_staff(), public.is_admin(), public.variant_label(jsonb, text[]),
  public.save_product(jsonb), public.set_featured_product(uuid),
  public.register_stock_in(uuid, integer, numeric, text), public.adjust_stock(uuid, integer, text),
  public.count_stock(uuid, integer, text),
  public.open_cash_session(uuid, numeric),
  public.add_cash_movement(uuid, public.cash_movement_type, numeric, text),
  public.close_cash_session(uuid, numeric, numeric, text),
  public.create_sale(uuid, public.payment_method, jsonb, numeric, text, text),
  public.void_sale(uuid, text)
  to authenticated;

-- Web pública: solo estas vistas (sin costos ni stock exacto).
grant select on public.public_categories, public.public_products, public.public_variants,
  public.public_store_info to anon, authenticated;
