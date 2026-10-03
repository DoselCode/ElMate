import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;
  const noAccess = error === "sin-acceso";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] bg-surface p-8 shadow-sm">
        <h1 className="font-serif text-2xl font-bold">El Mate</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Panel de administración</p>

        {noAccess && (
          <div role="alert" className="mb-5 rounded-xl bg-warning-soft p-3 text-sm text-warning">
            Tu usuario no tiene acceso al panel. Si creés que es un error, hablá con el administrador.
            <form action={signOutAction} className="mt-2">
              <button type="submit" className="font-semibold underline underline-offset-2">
                Cerrar sesión
              </button>
            </form>
          </div>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
