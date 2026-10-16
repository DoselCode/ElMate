import type { Metadata } from "next";
import { LoginScreen } from "@/front/admin/auth/login-screen";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;
  return <LoginScreen noAccess={error === "sin-acceso"} />;
}
