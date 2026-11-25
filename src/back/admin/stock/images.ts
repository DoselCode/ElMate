import { createClient } from "@/back/shared/supabase/browser";
import { newUuid } from "@/shared/uuid";

/**
 * Sube una foto de producto (o el fondo de una promo, con `folder`) a Supabase Storage y devuelve su URL
 * pública. Corre en el navegador (el archivo no pasa por el servidor de Next); el permiso lo controla
 * la política del bucket product-images: solo un admin puede subir.
 */
export async function uploadProductImage(blob: Blob, ext: "webp" | "jpg", folder?: "promociones" | "local"): Promise<string> {
  const supabase = createClient();
  const path = `${folder ? `${folder}/` : ""}${newUuid()}.${ext}`;
  const bucket = supabase.storage.from("product-images");

  const { error } = await bucket.upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) throw new Error("No se pudo subir la imagen");

  return bucket.getPublicUrl(path).data.publicUrl;
}

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/**
 * Sube el video de la portada al bucket público web-media y devuelve su URL. Corre en el navegador;
 * solo un admin puede subir (política del bucket). MP4 o WebM, hasta 50 MB.
 */
export async function uploadWebVideo(file: File): Promise<string> {
  const ext = file.type === "video/webm" ? "webm" : "mp4";
  const supabase = createClient();
  const path = `portada/${newUuid()}.${ext}`;
  const bucket = supabase.storage.from("web-media");
  const { error } = await bucket.upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error("No se pudo subir el video");
  return bucket.getPublicUrl(path).data.publicUrl;
}
