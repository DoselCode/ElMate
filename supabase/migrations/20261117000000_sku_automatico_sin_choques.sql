-- ElMate · el código automático (EM-00001…) ya no choca con códigos EM- existentes.
-- Si la base recibe variantes con códigos EM- cargados a mano o migrados sin sincronizar la
-- secuencia, next_sku() devolvía un código ocupado y no se podía crear ningún producto sin SKU.
-- Es aditivo: no cambia ni borra datos.

-- 1. Adelanta la secuencia hasta el mayor código EM- existente (nunca la atrasa).
-- v = último número ya usado (por la secuencia o por un código existente); 0 = ninguno.
select setval('public.sku_seq', greatest(s.v, 1), s.v > 0)
from (
  select greatest(
    (select case when is_called then last_value else last_value - 1 end from public.sku_seq),
    coalesce((select max(substring(sku from 4)::bigint) from public.product_variants where sku ~ '^EM-\d+$'), 0)
  ) as v
) s;

-- 2. Saltea códigos ocupados por si vuelven a cargarse a mano por delante de la secuencia.
create or replace function public.next_sku() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_sku text;
begin
  loop
    v_sku := 'EM-' || lpad(nextval('public.sku_seq')::text, 5, '0');
    exit when not exists (select 1 from public.product_variants where sku = v_sku);
  end loop;
  return v_sku;
end;
$$;
