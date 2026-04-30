"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { alertApiError, api } from "../../../lib/api";
import PaymentMethodRadio from "../../../components/forms/payment-method-radio";

type RegisterContext = { hkid: string; full_name: string; pin: string };

export default function RegisterReceiptPage() {
  const router = useRouter();
  const [ctx, setCtx] = useState<RegisterContext | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const raw = window.sessionStorage.getItem("zomate_register_context");
    if (!raw) {
      router.replace("/register");
      return;
    }
    setCtx(JSON.parse(raw) as RegisterContext);
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ctx) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("receipt");
    if (!(file instanceof File) || !file.name) {
      setStatus("請選擇收據檔案，或按「之後再上載」。");
      return;
    }
    try {
      setStatus("上載收據中…");
      await api.uploadMemberReceipt(ctx.hkid, {
        file,
        amount: String(form.get("amount") ?? ""),
        payment_method: String(form.get("payment_method") ?? ""),
        note: String(form.get("note") ?? ""),
        source: "REGISTER"
      });
      router.push("/register/success");
    } catch (err) {
      alertApiError(err);
      setStatus("");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-5 bg-zinc-950 p-6 text-white">
      <h1 className="text-xl font-semibold">上載收據記錄</h1>
      <p className="text-sm text-white/75">{ctx?.full_name} · image/pdf max 5MB</p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-white/15 bg-[#141414] p-5">
        <input name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="block w-full text-sm text-white/80" />
        <input name="amount" inputMode="decimal" placeholder="金額（可選）" className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-white" />
        <PaymentMethodRadio />
        <textarea name="note" rows={3} placeholder="備註（可選）" className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-white" />
        {status && <p className="text-sm text-amber-200">{status}</p>}
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium text-white">完成上載</button>
          <button type="button" onClick={() => router.push("/register/success")} className="rounded-md border border-white/20 px-4 py-2 text-sm text-white">Skip — 之後再上載</button>
        </div>
      </form>
    </main>
  );
}
