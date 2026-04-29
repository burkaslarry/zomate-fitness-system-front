"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePeriodicHealthPing } from "../../hooks/use-periodic-health-ping";

export default function StudentHome() {
  usePeriodicHealthPing();
  const pageRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!pageRef.current) return;
    const items = Array.from(pageRef.current.querySelectorAll("a,button")).map((el, index) => {
      const s = window.getComputedStyle(el);
      return {
        index,
        tag: el.tagName,
        href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null,
        className: el.getAttribute("class"),
        color: s.color,
        backgroundColor: s.backgroundColor,
        opacity: s.opacity,
        rect: {
          width: Math.round(el.getBoundingClientRect().width),
          height: Math.round(el.getBoundingClientRect().height)
        }
      };
    });
    // #region agent log
    fetch("http://127.0.0.1:7480/ingest/881a8b8b-14fd-4480-bb21-056e0c22cd5b", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "195967" },
      body: JSON.stringify({
        sessionId: "195967",
        runId: "pre-fix",
        hypothesisId: "H1,H2,H3,H4",
        location: "app/student/page.tsx:StudentHome/useEffect",
        message: "Computed styles for student home links/buttons",
        data: { htmlClass: document.documentElement.className, bodyClass: document.body.className, items },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
  }, []);

  return (
    <main ref={pageRef} className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">學生</h1>
        <Link href="/" className="text-sm text-slate-600 underline">
          返回主頁
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        入職：掃描後台「登記 QR」填表。續會：填 Membership Renewal Form 加堂。簽到：掃「簽到 QR」→ 搜尋自己姓名 → 輸入 PIN 扣堂。
      </p>
      <nav className="flex flex-col gap-3">
        <Link
          href="/student/onboard"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm hover:bg-slate-100"
        >
          新學生登記 · 健康聲明
        </Link>
        <Link
          href="/student/renewal"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm hover:bg-slate-100"
        >
          Membership Renewal Form · 續會加堂
        </Link>
        <Link
          href="/student/checkin"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm hover:bg-slate-100"
        >
          智能 QR 簽到（掃碼 → 揀名 → PIN）
        </Link>
        <Link
          href="/student/trial"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-950 shadow-sm hover:bg-slate-100"
        >
          試堂／加堂（示範）
        </Link>
      </nav>
    </main>
  );
}
