"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ArrowCounterClockwise, UploadSimple } from "@phosphor-icons/react";
import { uploadProductImage } from "@/back/admin/stock/images";
import { compressImage } from "@/front/admin/stock/image-uploader";
import { Button } from "@/front/shared/ui/button";
import { DEFAULT_PROMO_BACKGROUND } from "@/shared/schemas/promotion";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
/** El fondo ocupa toda la card: un poco más grande que las fotos de producto. */
const MAX_SIDE = 2000;

/**
 * Imagen de fondo de la card de una promo en la home. Muestra una vista previa con el título encima
 * (como se va a ver en la web); vacío = la imagen por defecto.
 */
export function BackgroundPicker({
  value,
  onChange,
  title,
  error,
}: {
  /** URL de la imagen subida, o "" para la de por defecto. */
  value: string;
  onChange: (url: string) => void;
  /** Título de la card, para la vista previa. */
  title: string;
  error?: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>();
  const isDefault = !value;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setMessage(undefined);
    if (!file.type.startsWith("image/")) return setMessage(`"${file.name}" no es una imagen.`);
    if (file.size > MAX_SOURCE_BYTES) return setMessage(`"${file.name}" pesa más de 15 MB.`);
    setUploading(true);
    try {
      const { blob, ext } = await compressImage(file, MAX_SIDE);
      onChange(await uploadProductImage(blob, ext, "promociones"));
    } catch {
      setMessage(`No se pudo subir "${file.name}". Probá de nuevo.`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <p id={`${inputId}-label`} className="text-sm font-medium">Imagen de fondo</p>

      {/* Vista previa: mismo oscurecido que en la home para que el texto se lea */}
      <div className="relative isolate flex aspect-[16/7] max-w-xl items-end overflow-hidden rounded-2xl bg-primary-deep p-5 text-white">
        <Image src={value || DEFAULT_PROMO_BACKGROUND} alt="" fill sizes="36rem" className="-z-10 object-cover" />
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-primary-deep/95 via-primary-deep/75 to-primary-deep/40" aria-hidden />
        <span className="font-display text-xl font-bold leading-tight drop-shadow">{title || "Título de la card"}</span>
        {isDefault && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-primary-deep">
            Imagen por defecto
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-labelledby={`${inputId}-label`}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <UploadSimple size={16} aria-hidden /> {uploading ? "Subiendo…" : isDefault ? "Subir imagen" : "Cambiar imagen"}
        </Button>
        {!isDefault && (
          <Button variant="ghost" size="sm" disabled={uploading} onClick={() => onChange("")}>
            <ArrowCounterClockwise size={16} aria-hidden /> Usar la imagen por defecto
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">JPG, PNG o WebP. Mejor horizontal; se oscurece para que el texto de la card se lea.</p>
      {(message || error) && (
        <p role="alert" className="text-xs font-medium text-danger">{message || error}</p>
      )}
    </div>
  );
}
