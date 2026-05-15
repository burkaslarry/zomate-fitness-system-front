"use client";

/**
 * [F006][S001]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Reusable form primitives: upload, select, payment radio.
 */

const METHODS = [
  ["cash", "Cash"],
  ["fps", "FPS"],
  ["cheque", "Cheque"],
  ["payme", "PayMe"],
  ["bank_transfer", "Bank transfer"],
  ["mastercard", "Mastercard"],
  ["visa", "Visa"],
  ["amex", "Amex"],
  ["unionpay", "UnionPay"]
] as const;

export default function PaymentMethodRadio({ name = "payment_method" }: { name?: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">付款方式</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {METHODS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink shadow-sm ring-1 ring-ink/[0.03]">
            <input type="radio" name={name} value={value} required className="accent-primary" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
