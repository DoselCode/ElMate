-- ElMate · imagen de fondo para la card de cada promoción en la home.
-- Es aditivo: no borra datos. null = la web usa su imagen de fondo por defecto.

alter table public.promotions
  add column card_image text check (card_image is null or (char_length(card_image) <= 500 and card_image ~* '^https?://'));

-- live_promotions es "select *": se recrea para que incluya la columna nueva (queda al final).
create or replace view public.live_promotions as
select * from public.promotions
where active and starts_at <= now() and (ends_at is null or ends_at > now());

-- La web la lee por la vista pública (columna nueva al final; los permisos se conservan).
create or replace view public.public_promotions as
select lp.id, lp.name, lp.slug, lp.description, lp.show_card, lp.card_title, lp.card_text, lp.card_cta, lp.starts_at, lp.ends_at,
       (select count(distinct pv.product_id)::integer
          from public.promotion_items pi join public.product_variants pv on pv.id = pi.variant_id
         where pi.promotion_id = lp.id) as product_count,
       lp.card_image
from public.live_promotions lp;

-- save_promotion() guarda también la imagen de fondo (vacía = la de por defecto).
-- p = { id?, name, slug, description?, active?, starts_at?, ends_at?, show_card?, card_title?, card_text?,
--       card_cta?, card_image?, items: [ { variant_id, promo_price } ] }
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
    insert into public.promotions (name, slug, description, active, starts_at, ends_at, show_card, card_title, card_text, card_cta, card_image)
    values (
      btrim(p ->> 'name'), p ->> 'slug', coalesce(p ->> 'description', ''),
      coalesce((p ->> 'active')::boolean, true), coalesce(nullif(p ->> 'starts_at', '')::timestamptz, now()),
      nullif(p ->> 'ends_at', '')::timestamptz, coalesce((p ->> 'show_card')::boolean, false),
      nullif(btrim(p ->> 'card_title'), ''), nullif(btrim(p ->> 'card_text'), ''), nullif(btrim(p ->> 'card_cta'), ''),
      nullif(btrim(p ->> 'card_image'), '')
    ) returning id into v_id;
  else
    update public.promotions set
      name = btrim(p ->> 'name'), slug = p ->> 'slug', description = coalesce(p ->> 'description', ''),
      active = coalesce((p ->> 'active')::boolean, true),
      starts_at = coalesce(nullif(p ->> 'starts_at', '')::timestamptz, starts_at),
      ends_at = nullif(p ->> 'ends_at', '')::timestamptz,
      show_card = coalesce((p ->> 'show_card')::boolean, false),
      card_title = nullif(btrim(p ->> 'card_title'), ''), card_text = nullif(btrim(p ->> 'card_text'), ''),
      card_cta = nullif(btrim(p ->> 'card_cta'), ''),
      card_image = nullif(btrim(p ->> 'card_image'), '')
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
