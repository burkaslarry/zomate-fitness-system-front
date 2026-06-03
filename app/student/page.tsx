"use client";

/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: (see Logic)
 * Logic: Student portal index and navigation.
 */

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
        入職：掃描後台「登記 QR」填表。買堂／試堂／續堂：統一進入 Payment / Receipt Entry。簽到：掃「簽到 QR」→ 搜尋自己姓名 → 輸入 PIN 扣堂。
      </p>
      <nav className="flex flex-col gap-3">
        <Link
          href="/register"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm hover:bg-slate-100"
        >
          新學生登記 · 健康聲明
        </Link>
        <Link
          href="/regCourse"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm hover:bg-slate-100"
        >
          Course Registration · 報 Course / 收費
        </Link>
        <Link
          href="/student/checkin"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm hover:bg-slate-100"
        >
          智能 QR 簽到（掃碼 → 揀名 → PIN）
        </Link>
        <Link
          href="/regCourse?type=trial"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm hover:bg-slate-100"
        >
          + Purchase / 買堂 · Payment First
        </Link>
      </nav>
    </main>
  );
}
