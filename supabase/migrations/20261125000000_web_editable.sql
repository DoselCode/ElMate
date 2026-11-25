-- ElMate · "Datos del local" edita también los textos de la home, el video de la portada y el logo.
-- Es aditivo: no borra datos. El logo ya existía (store_settings.logo) y ya estaba en la vista pública.
--   * home_texts: textos que reemplazan a los de la web, por clave ({"hero.text": "…"}). Lo que no está
--     en el objeto usa el texto por defecto del código.
--   * hero_video: video de la portada (URL subida al Storage). null = la animación de siempre.

alter table public.store_settings
  add column home_texts jsonb not null default '{}' check (jsonb_typeof(home_texts) = 'object'),
  add column hero_video text check (hero_video is null or (char_length(hero_video) <= 500 and hero_video ~* '^https?://'));

-- Misma vista que en 20261116000001, con las dos columnas nuevas al final (los permisos se conservan).
create or replace view public.public_store_info as
select name, tagline, logo, phone, whatsapp_number, address, instagram_url,
       hours_weekdays, hours_saturday, hours_sunday, instagram_posts,
       home_texts, hero_video
from public.store_settings;
