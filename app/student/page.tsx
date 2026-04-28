"use client";

import Link from "next/link";
import { usePeriodicHealthPing } from "../../hooks/use-periodic-health-ping";

export default function StudentHome() {
  usePeriodicHealthPing();
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">學生</h1>
        <Link href="/" className="text-sm text-slate-600 underline">
          返回主頁
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        入職：掃描後台「登記 QR」填表。簽到：掃「簽到 QR」→ 搜尋自己姓名 → 輸入 PIN 扣堂（亦可進階用電話 + PIN）。
      </p>
      <nav className="flex flex-col gap-3">
        <Link
          href="/student/onboard"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium shadow-sm"
        >
          新學生登記 · 健康聲明
        </Link>
        <Link
          href="/student/checkin"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium shadow-sm"
        >
          智能 QR 簽到（掃碼 → 揀名 → PIN）
        </Link>
        <Link
          href="/student/trial"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium shadow-sm"
        >
          試堂／加堂（示範）
        </Link>
      </nav>
    </main>
  );
}
