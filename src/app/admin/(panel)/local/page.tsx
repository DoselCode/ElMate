import type { Metadata } from "next";
import { getPaymentMethods, getStoreSettings } from "@/back/admin/settings/queries";
import { PaymentMethodsForm } from "@/front/admin/settings/payment-methods-form";
import { SettingsForm } from "@/front/admin/settings/settings-form";

export const metadata: Metadata = { title: "Datos del local" };

export default async function StoreSettingsPage() {
  const [initial, methods] = await Promise.all([getStoreSettings(), getPaymentMethods(true)]);
  return (
    <div className="space-y-6">
      <SettingsForm initial={initial} />
      <div className="mx-auto max-w-3xl">
        <PaymentMethodsForm initial={methods} />
      </div>
    </div>
  );
}
