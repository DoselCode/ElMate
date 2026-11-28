"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { ArrowCounterClockwise, UploadSimple } from "@phosphor-icons/react";
import { MAX_VIDEO_BYTES, uploadProductImage, uploadWebVideo } from "@/back/admin/stock/images";
import { compressImage } from "@/front/admin/stock/image-uploader";
import { Button } from "@/front/shared/ui/button";
import { Field, inputClass } from "@/front/shared/ui/field";
import { HOME_TEXT_DEFAULTS, HOME_TEXT_SECTIONS, type HomeTextKey } from "@/shared/home-content";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Botón "Subir" con un input de archivo oculto; muestra el error de la subida debajo. */
function UploadButton({
  accept,
  label,
  busyLabel,
  onFile,
}: {
  accept: string;
  label: string;
  busyLabel: string;
  onFile: (file: File) => Promise<void>;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            await onFile(file);
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
        <UploadSimple size={16} aria-hidden /> {busy ? busyLabel : label}
      </Button>
    </>
  );
}

/** Logo del local: se muestra en el encabezado y el pie de la web y en el menú del panel. */
export function LogoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [message, setMessage] = useState<string>();
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative grid h-24 w-48 place-items-center overflow-hidden rounded-2xl border border-border bg-background">
        {value ? (
          <Image src={value} alt="Logo actual" fill sizes="192px" className="object-contain p-2" />
        ) : (
          <span className="px-3 text-center text-xs text-muted">Se usa el logo de siempre (ELMATE)</span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <UploadButton
            accept="image/png,image/jpeg,image/webp"
            label={value ? "Cambiar logo" : "Subir logo"}
            busyLabel="Subiendo…"
            onFile={async (file) => {
              setMessage(undefined);
              if (!file.type.startsWith("image/")) return setMessage("El archivo no es una imagen.");
              if (file.size > MAX_IMAGE_BYTES) return setMessage("La imagen pesa más de 15 MB.");
              try {
                const { blob, ext } = await compressImage(file, 800);
                onChange(await uploadProductImage(blob, ext, "local"));
              } catch {
                setMessage("No se pudo subir el logo. Probá de nuevo.");
              }
            }}
          />
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange("")}>
              <ArrowCounterClockwise size={16} aria-hidden /> Usar el de siempre
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">PNG con fondo transparente queda mejor. Se ajusta solo al espacio.</p>
        {message && <p role="alert" className="text-xs font-medium text-danger">{message}</p>}
      </div>
    </div>
  );
}

/** Video de la portada de la web; sin video se ve la animación del termo cebando. */
export function HeroVideoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [message, setMessage] = useState<string>();
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative grid size-40 place-items-center overflow-hidden rounded-2xl border border-border bg-primary-deep">
        {value ? (
          <video src={value} muted loop autoPlay playsInline className="size-full object-cover" aria-label="Video actual de la portada" />
        ) : (
          <span className="px-3 text-center text-xs text-white/80">Se ve la animación de siempre</span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <UploadButton
            accept="video/mp4,video/webm"
            label={value ? "Cambiar video" : "Subir video"}
            busyLabel="Subiendo video…"
            onFile={async (file) => {
              setMessage(undefined);
              if (file.type !== "video/mp4" && file.type !== "video/webm") return setMessage("Tiene que ser un video MP4 o WebM.");
              if (file.size > MAX_VIDEO_BYTES) return setMessage("El video pesa más de 50 MB: probá con uno más corto o comprimido.");
              try {
                onChange(await uploadWebVideo(file));
              } catch {
                setMessage("No se pudo subir el video. Probá de nuevo.");
              }
            }}
          />
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange("")}>
              <ArrowCounterClockwise size={16} aria-hidden /> Usar la animación
            </Button>
          )}
        </div>
        <p className="text-xs text-muted">MP4 o WebM, hasta 50 MB. Se reproduce solo, sin sonido y en bucle; mejor cuadrado.</p>
        {message && <p role="alert" className="text-xs font-medium text-danger">{message}</p>}
      </div>
    </div>
  );
}

/** Textos de la home: cada campo muestra el texto actual de la web; vacío = el de por defecto. */
export function HomeTextsFields({
  value,
  errors,
  onChange,
}: {
  value: Record<string, string>;
  errors: Record<string, string>;
  onChange: (texts: Record<string, string>) => void;
}) {
  const set = (key: HomeTextKey, text: string) => onChange({ ...value, [key]: text });
  return (
    <div className="space-y-3">
      {HOME_TEXT_SECTIONS.map((section, i) => (
        <details key={section.title} open={i === 0} className="rounded-2xl border border-border bg-background/60 p-4">
          <summary className="cursor-pointer text-sm font-bold">{section.title}</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {section.fields.map((f) => {
              const id = `settings-text-${f.key}`;
              const error = errors[`homeTexts.${f.key}`];
              const current = value[f.key] ?? "";
              return (
                <Field
                  key={f.key}
                  label={f.label}
                  htmlFor={id}
                  error={error}
                  hint={current ? "Vaciá el campo para volver al texto original." : undefined}
                  className={f.long ? "md:col-span-2" : ""}
                >
                  {f.long ? (
                    <textarea
                      id={id}
                      rows={3}
                      maxLength={300}
                      value={current}
                      placeholder={HOME_TEXT_DEFAULTS[f.key]}
                      aria-invalid={Boolean(error)}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={inputClass}
                    />
                  ) : (
                    <input
                      id={id}
                      maxLength={300}
                      value={current}
                      placeholder={HOME_TEXT_DEFAULTS[f.key]}
                      aria-invalid={Boolean(error)}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={inputClass}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
