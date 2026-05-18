"use client";

/**
 * [F006][S001]
 * Feature: Shared API client (Next.js to FastAPI)
 * Logic: Reusable form primitives: upload, select, payment radio.
 */

/** [F002][S001] Unified payment module methods shown inside purchase / receipt entry. */
const METHODS = [
  ["cash", "Cash"],
  ["fps", "FPS"],
  ["cheque", "Cheque"],
  ["payme", "PayMe"],
  ["bank_transfer", "Bank transfer"],
  ["mastercard", "Mastercard"],
  ["visa", "Visa"],
  ["credit_card_installment", "Credit Card (Installment)"],
  ["amex", "Amex"],
  ["unionpay", "UnionPay"]
] as const;

export default function PaymentMethodRadio({ name = "payment_method" }: { name?: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">付款方式</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {METHODS.map(([value, label]) => (
          <label 
            key={value} 
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink/10 bg-canvas px-4 py-3 text-sm text-ink shadow-sm ring-1 ring-ink/[0.03] transition-colors hover:bg-ink/[0.02]"
          >
            {/* Added shrink-0 and fixed dimensions */}
            <input 
              type="radio" 
              name={name} 
              value={value} 
              required 
              className="h-4 w-4 shrink-0 accent-primary" 
            />
            {/* Wrapped label text in a span to control flow */}
            <span className="flex-1 font-medium leading-none">
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}