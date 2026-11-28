-- Publicaciones de Instagram de la home: se cargan en "Datos del local" pegando el link de cada una
-- (hasta 6, la más nueva primero) y la web las muestra incrustadas.

alter table public.store_settings
  add column instagram_posts text[] not null default '{}'
  check (cardinality(instagram_posts) <= 6);

-- Se agrega al final de la vista (create or replace no permite reordenar columnas); los permisos se mantienen.
create or replace view public.public_store_info as
select name, tagline, logo, phone, whatsapp_number, email, address, instagram_url, facebook_url,
       hours_weekdays, hours_saturday, hours_sunday, instagram_posts
from public.store_settings;
