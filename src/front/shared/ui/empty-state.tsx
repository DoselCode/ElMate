/** Tarjeta para listados vacíos ("no hay resultados"). */
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-10 text-center shadow-sm">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}

/** Aviso de error al cargar un listado. */
export function LoadError({ text }: { text: string }) {
  return (
    <p role="alert" className="rounded-xl bg-danger-soft p-4 text-sm font-medium text-danger">
      {text}
    </p>
  );
}
