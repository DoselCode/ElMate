import type { Metadata } from "next";
import { getStoreSettings } from "@/back/admin/settings/queries";
import { SettingsForm } from "@/front/admin/settings/settings-form";

export const metadata: Metadata = { title: "Datos del local" };

export default async function StoreSettingsPage() {
  const initial = await getStoreSettings();
  return <SettingsForm initial={initial} />;
}
