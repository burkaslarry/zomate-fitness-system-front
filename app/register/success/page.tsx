"use client";

/**
 * [F001][S001]
 * Feature: Student Onboarding
 * Step: (see Logic)
 * Logic: Public registration flow pages: photo, receipt, success.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

type RegisterContext = { hkid: string; full_name: string; pin?: string };

export default function RegisterSuccessPage() {
  const [ctx, setCtx] = useState<RegisterContext | null>(null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("zomate_register_context");
    if (raw) setCtx(JSON.parse(raw) as RegisterContext);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center space-y-6 bg-canvas p-6 text-ink">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <p className="text-sm text-emerald-900">完成報名</p>
        <h1 className="mt-2 text-2xl font-semibold">{ctx?.full_name ?? "會員"}</h1>
        <p className="mt-4 text-sm text-ink/75">資料已提交，請返回學生入口繼續後續流程。</p>
      </div>
      <Link href="/" className="text-center text-sm text-ink/70 underline underline-offset-4">返回學生入口</Link>
    </main>
  );
}
