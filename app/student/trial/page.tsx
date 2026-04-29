"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { alertApiError, api } from "../../../lib/api";
import { usePeriodicHealthPing } from "../../../hooks/use-periodic-health-ping";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm [color-scheme:light] placeholder:text-slate-400";

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
      setStatus("");
      alertApiError(err);
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 text-white">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-white">試堂／加堂</h1>
        <Link
          href="/student"
          className="text-sm text-sky-400 underline underline-offset-2 hover:text-sky-300"
        >
          返回
        </Link>
      </div>
      <p className="text-sm text-zinc-400">
        示範：後台確認收款後可代學生加餘額（實際流程會接 WhatsApp API）。
      </p>
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg bg-white p-4 shadow [color-scheme:light] text-slate-900"
      >
        <input name="phone" className={fieldClass} placeholder="學生電話" required />
        <input
          name="credits"
          type="number"
          min={1}
          defaultValue={10}
          className={fieldClass}
          required
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          加堂 + 歡迎訊息
        </button>
      </form>
      {status && <p className="text-sm text-zinc-300">{status}</p>}
    </main>
  );
}
