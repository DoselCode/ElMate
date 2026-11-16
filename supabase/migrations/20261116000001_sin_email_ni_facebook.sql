-- La web solo muestra Instagram y WhatsApp: se borran los datos de email y Facebook del local
-- y se quitan de la vista pública (las columnas de store_settings quedan, sin uso).

update public.store_settings set email = null, facebook_url = null;

drop view public.public_store_info;
create view public.public_store_info as
select name, tagline, logo, phone, whatsapp_number, address, instagram_url,
       hours_weekdays, hours_saturday, hours_sunday, instagram_posts
from public.store_settings;

revoke all on public.public_store_info from anon, authenticated;
grant select on public.public_store_info to anon, authenticated;
