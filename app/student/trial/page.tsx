"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "../../../lib/api";
import { usePeriodicHealthPing } from "../../../hooks/use-periodic-health-ping";

export default function StudentTrialPage() {
  usePeriodicHealthPing();
  const [status, setStatus] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("處理中…");
    try {
      await api.trialPurchase({
        phone: form.get("phone"),
        credits: Number(form.get("credits"))
      });
      setStatus("已加堂並發送示範 WhatsApp。");
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">試堂／加堂</h1>
        <Link href="/student" className="text-sm text-slate-600 underline">
          返回
        </Link>
      </div>
      <p className="text-sm text-slate-600">示範：後台確認收款後可代學生加餘額（實際流程會接 WhatsApp API）。</p>
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg bg-white p-4 shadow">
        <input name="phone" placeholder="學生電話" required />
        <input name="credits" type="number" min={1} defaultValue={10} required />
        <button type="submit">加堂 + 歡迎訊息</button>
      </form>
      {status && <p className="text-sm">{status}</p>}
    </main>
  );
}
