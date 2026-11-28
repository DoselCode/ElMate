-- Registro seguro: solo es personal activo quien creó el admin (usuario con email ya confirmado) o el primero.
--
-- Antes todo usuario nuevo entraba como empleado ACTIVO, y eso dependía de tener apagado el registro público
-- en Supabase Auth. Si ese interruptor falla o se vuelve a prender (por ejemplo el alta por teléfono con
-- autoconfirmación, o el registro anónimo), cualquiera podía crearse una cuenta y ver el panel.
-- Ahora un usuario que se registra solo (email sin confirmar, teléfono o anónimo) queda INACTIVO: la base no le
-- da acceso (is_staff / is_admin exigen active) hasta que un admin lo active.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first boolean := not exists (select 1 from public.profiles);
  v_created_by_admin boolean :=
    coalesce(new.raw_app_meta_data ->> 'provider', '') = 'email'
    and new.email_confirmed_at is not null
    and not coalesce(new.is_anonymous, false);
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)), 80),
    case when v_first then 'admin'::public.app_role else 'empleado'::public.app_role end,
    v_first or v_created_by_admin
  );
  return new;
end $$;
