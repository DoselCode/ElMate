"use client";

import { useActionState } from "react";
import { signInAction, type LoginState } from "@/back/admin/auth/actions";
import { Button } from "@/front/shared/ui/button";
import { Field, inputClass, inputErrorClass } from "@/front/shared/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state?.email}
          className={inputClass}
        />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={state?.error}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state?.error)}
          aria-describedby={state?.error ? "password-error" : undefined}
          className={`${inputClass} ${state?.error ? inputErrorClass : ""}`}
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
