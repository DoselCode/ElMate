import { signOutAction } from "@/back/admin/auth/actions";
import { LoginForm } from "./login-form";

/** Pantalla de ingreso al panel. `noAccess`: el usuario tiene sesión pero fue dado de baja. */
export function LoginScreen({ noAccess }: { noAccess: boolean }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] bg-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold">El Mate</h1>
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
