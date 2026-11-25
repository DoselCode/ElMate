-- Videos de la web (portada). Bucket público aparte: el de fotos solo acepta imágenes de hasta 5 MB.
-- Solo un admin puede subir, reemplazar o borrar (igual que product-images).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('web-media', 'web-media', true, 52428800, array['video/mp4', 'video/webm'])
on conflict (id) do nothing;

create policy "web-media: admin lee" on storage.objects for select to authenticated
  using (bucket_id = 'web-media' and public.is_admin());
create policy "web-media: admin sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'web-media' and public.is_admin());
create policy "web-media: admin reemplaza" on storage.objects for update to authenticated
  using (bucket_id = 'web-media' and public.is_admin())
  with check (bucket_id = 'web-media' and public.is_admin());
create policy "web-media: admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'web-media' and public.is_admin());
