"use client";

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
      <legend className="text-sm font-medium text-white/85">付款方式</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {METHODS.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white">
            <input type="radio" name={name} value={value} required className="accent-[#6366f1]" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
