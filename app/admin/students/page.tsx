"use client";

import BackendShell from "../../../components/backend-shell";
import Link from "next/link";

export default function AdminStudentsPage() {
  return (
    <BackendShell title="學生管理">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">學生名單</h2>
        <p className="text-sm text-slate-400">Demo 導覽頁：可於主後台進行學生資料、餘額與 FaceID 綁定管理。</p>
        <Link href="/admin" className="inline-block rounded-md border border-slate-500 px-4 py-2 text-sm text-slate-200">
          打開完整學生管理明細
        </Link>
      </div>
    </BackendShell>
  );
}
