import { createClient } from "@/back/shared/supabase/browser";

/**
 * Sube una foto de producto a Supabase Storage y devuelve su URL pública.
 * Corre en el navegador (el archivo no pasa por el servidor de Next); el permiso lo controla
 * la política del bucket product-images: solo un admin puede subir.
 */
export async function uploadProductImage(blob: Blob, ext: "webp" | "jpg"): Promise<string> {
  const supabase = createClient();
  const path = `${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from("product-images");

  const { error } = await bucket.upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) throw new Error("No se pudo subir la imagen");

  return bucket.getPublicUrl(path).data.publicUrl;
}
