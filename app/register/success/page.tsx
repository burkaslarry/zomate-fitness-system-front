"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RegisterContext = { hkid: string; full_name: string; pin: string };

export default function RegisterSuccessPage() {
  const [ctx, setCtx] = useState<RegisterContext | null>(null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("zomate_register_context");
    if (raw) setCtx(JSON.parse(raw) as RegisterContext);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center space-y-6 bg-zinc-950 p-6 text-white">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <p className="text-sm text-emerald-100">完成報名</p>
        <h1 className="mt-2 text-2xl font-semibold">{ctx?.full_name ?? "會員"}</h1>
        <p className="mt-6 text-sm text-white/70">簽到 PIN</p>
        <p className="mt-2 font-mono text-5xl font-bold tracking-widest text-white">{ctx?.pin ?? "-----"}</p>
      </div>
      <button disabled title="WhatsApp 未接駁 — Coming soon" className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/45">
        Send PIN to my WhatsApp · WhatsApp 未接駁 — Coming soon
      </button>
      <Link href="/student" className="text-center text-sm text-white/75 underline underline-offset-4">返回學生入口</Link>
    </main>
  );
}
