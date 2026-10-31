"use client";

import { useState, useTransition } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { saveHomeTextsAction } from "@/back/admin/web/actions";
import { Button } from "@/front/shared/ui/button";
import { Field, inputClass, inputErrorClass } from "@/front/shared/ui/field";
import { HOME_FIELDS, HOME_GROUPS, type HomeTexts } from "@/shared/home-content";

/**
 * "Textos de la web": cada campo muestra el texto actual de la home. Si lo dejás vacío (o con "Restablecer")
 * vuelve al texto original. Lo que se guarda se ve en la web al instante.
 */
export function HomeTextsForm({ initial }: { initial: HomeTexts }) {
  // Cada campo arranca con lo que se ve hoy en la web: el texto cambiado o el original
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(HOME_FIELDS.map((f) => [f.key, initial[f.key] ?? f.default])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const changed = HOME_FIELDS.filter((f) => values[f.key].trim() !== f.default).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(undefined);
    startTransition(async () => {
      const res = await saveHomeTextsAction(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage({ ok: false, text: res.error });
        return;
      }
      setErrors({});
      setMessage({ ok: true, text: "Textos guardados. La web ya los muestra." });
    });
  }

  const reset = (keys: string[]) => {
    setValues((v) => ({ ...v, ...Object.fromEntries(keys.map((k) => [k, HOME_FIELDS.find((f) => f.key === k)!.default])) }));
    setMessage(undefined);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Textos de la web</h1>
          <p className="mt-1 text-sm text-muted">
            Cambiá los títulos y textos de la home a tu gusto. Lo que dejes vacío vuelve al texto original.
          </p>
        </div>
        {changed > 0 && (
          <Button variant="ghost" onClick={() => reset(HOME_FIELDS.map((f) => f.key))}>
            <ArrowCounterClockwise size={16} aria-hidden /> Restablecer todo
          </Button>
        )}
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {HOME_GROUPS.map((group) => (
          <section key={group.id} className="rounded-[var(--radius-card)] bg-surface p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-lg font-bold">{group.title}</h2>
            <p className="mb-4 mt-0.5 text-sm text-muted">{group.description}</p>
            <div className="space-y-4">
              {group.fields.map((f) => {
                const id = `home-${f.key}`;
                const isDefault = values[f.key].trim() === f.default;
                const error = errors[f.key];
                const common = {
                  id,
                  value: values[f.key],
                  maxLength: f.max,
                  "aria-invalid": Boolean(error),
                  "aria-describedby": error ? `${id}-error` : undefined,
                  className: `${inputClass} ${error ? inputErrorClass : ""}`,
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value })),
                };
                return (
                  <Field key={f.key} label={f.label} htmlFor={id} error={error}>
                    {f.multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}
                    <p className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                      <span>{isDefault ? "Texto original" : "Personalizado"}</span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums">{values[f.key].length}/{f.max}</span>
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => reset([f.key])}
                            className="inline-flex cursor-pointer items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            <ArrowCounterClockwise size={12} aria-hidden /> Restablecer
                          </button>
                        )}
                      </span>
                    </p>
                  </Field>
                );
              })}
            </div>
          </section>
        ))}
      </div>

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
