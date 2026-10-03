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
