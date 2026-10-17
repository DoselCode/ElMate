"use client";

import { useState, useTransition } from "react";
import { saveStoreSettingsAction } from "@/back/admin/settings/actions";
import { Button } from "@/front/shared/ui/button";
import { TextField } from "@/front/shared/ui/field";
import { fieldErrors } from "@/shared/schemas/product";
import { storeSettingsSchema, type StoreSettingsInput } from "@/shared/schemas/settings";

type Key = keyof StoreSettingsInput;

const SECTIONS: { title: string; description: string; fields: { key: Key; label: string; placeholder?: string; type?: string }[] }[] = [
  {
    title: "El local",
    description: "Se muestran en el encabezado y el pie de la web.",
    fields: [
      { key: "name", label: "Nombre *", placeholder: "El Mate" },
      { key: "tagline", label: "Frase corta", placeholder: "Todo para tu ronda de mate" },
    ],
  },
  {
    title: "Pedidos y contacto",
    description: "El WhatsApp es el número al que llegan los pedidos del carrito. Sin WhatsApp, la web no puede enviar pedidos.",
    fields: [
      { key: "whatsappNumber", label: "WhatsApp para pedidos", placeholder: "+54 9 11 5555-1234", type: "tel" },
      { key: "phone", label: "Teléfono", placeholder: "011 4444-5555", type: "tel" },
      { key: "email", label: "Email", placeholder: "hola@elmate.com.ar", type: "email" },
      { key: "address", label: "Dirección", placeholder: "Calle 123, Ciudad" },
    ],
  },
  {
    title: "Redes",
    description: "Pegá el link completo del perfil.",
    fields: [
      { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/elmate", type: "url" },
      { key: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/elmate", type: "url" },
    ],
  },
  {
    title: "Horarios",
    description: "Dejá vacío el día que no abren.",
    fields: [
      { key: "hoursWeekdays", label: "Lunes a viernes", placeholder: "9 a 19 h" },
      { key: "hoursSaturday", label: "Sábados", placeholder: "9 a 13 h" },
      { key: "hoursSunday", label: "Domingos", placeholder: "" },
    ],
  },
];

export function SettingsForm({ initial }: { initial: StoreSettingsInput }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(undefined);
    const checked = storeSettingsSchema.safeParse(values);
    if (!checked.success) {
      setErrors(fieldErrors(checked.error));
      queueMicrotask(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await saveStoreSettingsAction(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: "Datos guardados. La web ya los muestra." });
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl space-y-6 pb-10">
      <header>
        <h1 className="font-display text-2xl font-bold">Datos del local</h1>
        <p className="mt-1 text-sm text-muted">Lo que ven los clientes en la web: contacto, redes, horarios y el WhatsApp de pedidos.</p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="rounded-[var(--radius-card)] bg-surface p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold">{section.title}</h2>
          <p className="mb-4 mt-0.5 text-sm text-muted">{section.description}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((f) => (
              <TextField
                key={f.key}
                id={`settings-${f.key}`}
                label={f.label}
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                value={values[f.key]}
                error={errors[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm font-semibold ${message.ok ? "text-success" : "text-danger"}`}>
            {message.text}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
