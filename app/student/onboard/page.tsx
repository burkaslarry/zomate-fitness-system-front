"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { api } from "../../../lib/api";

export default function StudentOnboardPage() {
  const [status, setStatus] = useState("");
  const [assignedPin, setAssignedPin] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("提交中…");
    setAssignedPin(null);
    const form = new FormData(e.currentTarget);
    const disclaimer = form.get("disclaimer_accepted") === "on";
    if (!disclaimer) {
      setStatus("請勾選同意免責聲明。");
      return;
    }
    try {
      const res = (await api.onboarding({
        full_name: form.get("full_name"),
        phone: form.get("phone"),
        email: form.get("email") || null,
        health_notes: form.get("health_notes") || null,
        disclaimer_accepted: true
      })) as { pin_code?: string };
      setAssignedPin(res.pin_code ?? null);
      setStatus("登記成功！後台會即時見到你嘅紀錄。請保存簽到 PIN（已透過示範 WhatsApp log 記錄）。");
      e.currentTarget.reset();
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">新學生登記</h1>
        <Link href="/student" className="text-sm text-slate-600 underline">
          返回
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        免責條款：參加本中心訓練前，請確認已理解運動風險；如有長期病患請先諮詢醫生。提交即表示同意中心之免責及私隱安排（示範文案）。
      </p>
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg bg-white p-4 shadow">
        <input name="full_name" placeholder="姓名" required />
        <input name="phone" placeholder="電話（+852…）" required />
        <input name="email" type="email" placeholder="電郵（可選）" />
        <textarea name="health_notes" placeholder="健康申報／注意事項" rows={4} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="disclaimer_accepted" className="mt-1 w-auto" required />
          <span>本人已閱讀並同意健康聲明及免責條款（示範）</span>
        </label>
        <button type="submit">提交登記</button>
      </form>
      {assignedPin && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
          你嘅簽到 PIN：<span className="font-mono text-lg">{assignedPin}</span>（請記低，簽到時用）
        </p>
      )}
      {status && <p className="text-sm text-slate-700">{status}</p>}
    </main>
  );
}
