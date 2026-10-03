import type { InputHTMLAttributes, ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/70 " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-background disabled:text-muted";

export const inputErrorClass = "border-danger focus:border-danger focus:ring-danger/20";

/** Campo de texto/número con label, ayuda y error ya enlazados (aria-invalid / aria-describedby). */
export function TextField({
  id,
  label,
  error,
  hint,
  className = "",
  ...input
}: { id: string; label: string; error?: string; hint?: string; className?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "className"
>) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${error ? inputErrorClass : ""}`}
        {...input}
      />
    </Field>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
