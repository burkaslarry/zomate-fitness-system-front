"use client";

import BackendShell from "../../../../components/backend-shell";
import Link from "next/link";

export default function AdminQrConsolePage() {
  return (
    <BackendShell title="QR 簽到中心">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">出勤 / 簽到管理</h2>
        <p className="text-sm text-slate-400">Demo 導覽頁：可集中管理簽到 QR、JSON QR、出勤核銷流程。</p>
        <Link href="/admin" className="inline-block rounded-md border border-slate-500 px-4 py-2 text-sm text-slate-200">
          打開完整 QR 與出勤明細
        </Link>
      </div>
    </BackendShell>
  );
}
