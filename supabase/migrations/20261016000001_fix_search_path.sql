-- Fija el search_path de las funciones que no lo tenían (aviso "function_search_path_mutable"
-- del asesor de seguridad de Supabase). Evita que un objeto con el mismo nombre en otro schema
-- cambie lo que ejecutan.
alter function public.set_updated_at() set search_path = public;
alter function public.stock_movements_immutable() set search_path = public;
alter function public.variant_label(jsonb, text[]) set search_path = public;
