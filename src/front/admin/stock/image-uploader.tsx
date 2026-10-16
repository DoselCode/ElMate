"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ArrowLeft, Star, Trash, UploadSimple } from "@phosphor-icons/react";
import { uploadProductImage } from "@/back/admin/stock/images";

const MAX_IMAGES = 6;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 1600;

/** Reduce a 1600px de lado mayor y recodifica (WebP, o JPEG si el navegador no lo soporta) para no subir fotos de 8 MB. */
async function compressImage(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  const webp = await encode("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpg = await encode("image/jpeg", 0.88);
  if (!jpg) throw new Error("No se pudo procesar la imagen");
  return { blob: jpg, ext: "jpg" };
}

export function ImageUploader({
  images,
  onChange,
  error,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  error?: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setMessage(undefined);

    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setMessage(`Se pueden cargar hasta ${MAX_IMAGES} imágenes; se subieron solo las primeras.`);

    setUploading(true);
    const uploaded: string[] = [];
    for (const file of picked) {
      if (!file.type.startsWith("image/")) {
        setMessage(`"${file.name}" no es una imagen.`);
        continue;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        setMessage(`"${file.name}" pesa más de 15 MB.`);
        continue;
      }
      try {
        const { blob, ext } = await compressImage(file);
        uploaded.push(await uploadProductImage(blob, ext));
      } catch {
        setMessage(`No se pudo subir "${file.name}". Probá de nuevo.`);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (uploaded.length) onChange([...images, ...uploaded]);
  }

  const iconBtn =
    "grid size-8 cursor-pointer place-items-center rounded-full bg-surface/95 text-foreground shadow transition-colors hover:bg-primary hover:text-white";

  return (
    <div>
      <ul className="flex flex-wrap gap-3">
        {images.map((src, i) => (
          <li key={src} className="relative size-28 overflow-hidden rounded-2xl border border-border bg-background">
            <Image src={src} alt={`Imagen ${i + 1} del producto`} fill sizes="112px" className="object-cover" />
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-bold text-white">
                <Star size={10} weight="fill" aria-hidden /> Principal
              </span>
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
              {i > 0 ? (
                <button
                  type="button"
                  className={iconBtn}
                  title="Hacer principal"
                  aria-label={`Hacer principal la imagen ${i + 1}`}
                  onClick={() => onChange([images[i], ...images.filter((_, j) => j !== i)])}
                >
                  <ArrowLeft size={16} aria-hidden />
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className={iconBtn}
                title="Quitar imagen"
                aria-label={`Quitar la imagen ${i + 1}`}
                onClick={() => onChange(images.filter((_, j) => j !== i))}
              >
                <Trash size={16} aria-hidden />
              </button>
            </div>
          </li>
        ))}

        {images.length < MAX_IMAGES && (
          <li>
            <label
              htmlFor={inputId}
              className={`grid size-28 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border-strong bg-background text-center text-xs font-medium text-muted transition-colors hover:border-primary hover:text-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <span className="flex flex-col items-center gap-1 px-2">
                <UploadSimple size={22} aria-hidden />
                {uploading ? "Subiendo…" : "Agregar fotos"}
              </span>
              <input
                ref={fileRef}
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </li>
        )}
      </ul>
      <p className="mt-2 text-xs text-muted">
        JPG, PNG o WebP. Se optimizan automáticamente. La primera es la imagen principal.
      </p>
      {(message || error) && (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error ?? message}
        </p>
      )}
    </div>
  );
}
