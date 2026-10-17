import "server-only";
import { createClient } from "@/back/shared/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Corre la consulta a la vez que se valida el permiso, en lugar de esperar uno y después la otra:
 * ahorra un viaje a Supabase por página. Si el permiso falla, el resultado se descarta (y RLS
 * igual impide que la base devuelva datos ajenos).
 */
export async function guarded<T>(check: () => Promise<unknown>, run: (supabase: Supabase) => PromiseLike<T>): Promise<T> {
  const supabase = await createClient();
  const [, result] = await Promise.all([check(), run(supabase)]);
  return result;
}
