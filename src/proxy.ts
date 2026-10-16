import type { NextRequest } from "next/server";
import { updateAdminSession } from "@/back/shared/supabase/proxy";

// Next.js exige que este archivo viva en src/. La lógica está en back/shared/supabase/proxy.ts.
export function proxy(request: NextRequest) {
  return updateAdminSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
