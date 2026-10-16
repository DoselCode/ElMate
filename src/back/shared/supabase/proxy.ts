import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

const LOGIN = "/admin/login";
const HOME = "/admin/stock";

/**
 * Lo ejecuta src/proxy.ts en cada navegación del panel: refresca la sesión de Supabase (cookies)
 * y manda al login a quien no la tenga.
 *
 * Es solo un chequeo optimista: la autorización real (rol, permisos) se valida en
 * back/admin/auth/session.ts en cada página y acción, y finalmente en la base con RLS.
 */
export async function updateAdminSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const isLogin = request.nextUrl.pathname === LOGIN;

  if (!isLoggedIn && !isLogin) return redirectTo(request, LOGIN);
  // Con ?error=... se queda en el login: es un usuario con sesión pero sin acceso (dado de baja)
  if (isLoggedIn && isLogin && !request.nextUrl.searchParams.has("error")) return redirectTo(request, HOME);

  return response;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
