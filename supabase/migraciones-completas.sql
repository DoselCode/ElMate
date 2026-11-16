-- ===== supabase/migrations/20261002000000_core_schema.sql =====
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


-- ===== supabase/migrations/20261002000001_storage.sql =====
-- Imágenes de productos. Bucket público (se sirven por URL directa, sin listado);
-- solo un admin puede subir, reemplazar o borrar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "product-images: admin lee" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin reemplaza" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());


-- ===== supabase/migrations/20261002000002_stock_views.sql =====
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


-- ===== supabase/migrations/20261016000000_web_publica.sql =====
-- ElMate · web pública (Diseño 2): ofertas, categorías con foto, más vendidos y redes.
-- Va encima de 20261002000000_core_schema.sql, que ya está aplicada en la base real.

-- ---------------------------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------------------------
-- "Precio anterior" para mostrar tachado en la web (oferta). Opcional; si está, es mayor al precio.
alter table public.product_variants
  add column compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price > price);

-- Foto de la tarjeta de categoría en la web
alter table public.categories add column image text;

alter table public.store_settings add column facebook_url text;

-- ---------------------------------------------------------------------------------------------
-- save_product() ahora guarda también el precio anterior
-- ---------------------------------------------------------------------------------------------
-- Alta o edición de un producto con todas sus variantes, en una sola transacción.
-- p = { id?, name, slug, description?, category_id?, supplier_id?, option_names?[], images?[],
--       is_visible?, badge?, variants: [{ id?, sku, barcode?, attributes?, price, compare_at_price?,
--       cost?, min_stock?, image?, active?, initial_stock? }] }
-- Las variantes existentes que no vengan en la lista se desactivan (no se borran: tienen historial).
create or replace function public.save_product(p jsonb) returns uuid
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
      insert into public.product_variants (product_id, sku, barcode, attributes, price, compare_at_price, min_stock, image, active)
      values (
        v_id, upper(coalesce(nullif(btrim(v ->> 'sku'), ''), public.next_sku())),
        nullif(btrim(v ->> 'barcode'), ''), coalesce(v -> 'attributes', '{}'::jsonb),
        (v ->> 'price')::numeric, (v ->> 'compare_at_price')::numeric, coalesce((v ->> 'min_stock')::integer, 0),
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
        compare_at_price = (v ->> 'compare_at_price')::numeric,
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

-- ---------------------------------------------------------------------------------------------
-- Vistas públicas: se recrean con precio anterior, % de descuento, "Desde", conteo por categoría
-- y más vendidos. Siguen sin exponer costos ni stock exacto.
-- ---------------------------------------------------------------------------------------------
drop view public.public_categories;
drop view public.public_variants;
drop view public.public_products;
drop view public.public_store_info;

-- Un producto aparece en la web si está visible, no archivado y tiene al menos una variante activa.
-- La tarjeta muestra la variante más barata: su precio, su precio anterior y su % de descuento.
create view public.public_products as
select
  p.id, p.name, p.slug, p.description, p.images, p.badge, p.is_featured, p.option_names, p.created_at,
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
         count(distinct price) > 1 as has_price_range, -- la tarjeta dice "Desde" solo si hay precios distintos
         coalesce(bool_or(stock > 0), false) as in_stock
  from public.product_variants where product_id = p.id and active
) stats
where p.is_visible and p.archived_at is null;

create view public.public_variants as
select pv.id, pv.product_id, pv.attributes, public.variant_label(pv.attributes, p.option_names) as label,
       pv.price, pv.compare_at_price, pv.image, (pv.stock > 0) as in_stock
from public.product_variants pv
join public.products p on p.id = pv.product_id
where pv.active and p.is_visible and p.archived_at is null;

-- Categorías con la cantidad de productos que se ven en la web.
create view public.public_categories as
select c.id, c.name, c.slug, c.image, c.sort_order,
       (select count(*)::integer from public.public_products pp where pp.category_slug = c.slug) as product_count
from public.categories c;

-- Los más vendidos de los últimos 90 días (solo el orden, sin exponer cantidades).
create view public.public_best_sellers as
select pv.product_id, row_number() over (order by sum(si.quantity) desc, pv.product_id)::integer as rank
from public.sale_items si
join public.sales s on s.id = si.sale_id and s.status = 'pagada' and s.created_at > now() - interval '90 days'
join public.product_variants pv on pv.id = si.variant_id
where exists (select 1 from public.public_products pp where pp.id = pv.product_id)
group by pv.product_id
order by rank
limit 12;

create view public.public_store_info as
select name, tagline, logo, phone, whatsapp_number, email, address, instagram_url, facebook_url,
       hours_weekdays, hours_saturday, hours_sunday
from public.store_settings;

-- ---------------------------------------------------------------------------------------------
-- Privilegios: lo nuevo arranca sin permisos (ver core_schema); se concede solo lectura pública.
-- ---------------------------------------------------------------------------------------------
revoke all on public.public_categories, public.public_products, public.public_variants,
  public.public_best_sellers, public.public_store_info from anon, authenticated;
grant select on public.public_categories, public.public_products, public.public_variants,
  public.public_best_sellers, public.public_store_info to anon, authenticated;
-- Postgres chequea EXECUTE con el usuario que consulta aunque la vista sea del dueño:
-- public_variants usa variant_label (función pura, solo arma "Negro / Grande").
grant execute on function public.variant_label(jsonb, text[]) to anon;

-- ===== supabase/migrations/20261016000001_fix_search_path.sql =====
-- Fija el search_path de las funciones que no lo tenían (aviso "function_search_path_mutable"
-- del asesor de seguridad de Supabase). Evita que un objeto con el mismo nombre en otro schema
-- cambie lo que ejecutan.
alter function public.set_updated_at() set search_path = public;
alter function public.stock_movements_immutable() set search_path = public;
alter function public.variant_label(jsonb, text[]) set search_path = public;


-- ===== supabase/migrations/20261018000000_lista_de_precios_y_ventas.sql =====
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


-- ===== supabase/migrations/20261021000000_descuentos.sql =====
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


-- ===== supabase/migrations/20261022000000_web_sin_precio_cero.sql =====
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


-- ===== supabase/migrations/20261031000000_web_configurable.sql =====
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


-- ===== supabase/migrations/20261113000000_promociones_y_personalizacion.sql =====
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


