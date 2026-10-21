import type { Metadata } from "next";
import { getPaymentMethods, getStoreSettings } from "@/back/admin/settings/queries";
import { PaymentMethodsForm } from "@/front/admin/settings/payment-methods-form";
import { SettingsForm } from "@/front/admin/settings/settings-form";
import { STAGE_2 } from "@/shared/features";

export const metadata: Metadata = { title: "Datos del local" };

export default async function StoreSettingsPage() {
  const [initial, methods] = await Promise.all([getStoreSettings(), STAGE_2 ? getPaymentMethods(true) : []]);
  return (
    <div className="space-y-6">
      <SettingsForm initial={initial} />
      {/* Las formas de pago se usan al vender: se configuran en la entrega final (shared/features.ts) */}
      {STAGE_2 && (
        <div className="mx-auto max-w-3xl">
          <PaymentMethodsForm initial={methods} />
        </div>
      )}
    </div>
  );
}
