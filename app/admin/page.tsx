"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendShell from "../../components/backend-shell";
import { api } from "../../lib/api";
import { useDemoState } from "../../lib/demo-state";

type Summary = Record<string, number>;

function summaryValue(summary: Summary, keys: string[]) {
  for (const key of keys) {
    if (typeof summary[key] === "number") return summary[key];
  }
  return 0;
}

export default function AdminPage() {
  const [summary, setSummary] = useState<Summary>({});
  const [status, setStatus] = useState("");
  const { students, whatsappLogs, checkinsCount, totalExpenses } = useDemoState();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    api
      .summary()
      .then((data) => {
        setSummary(data as Summary);
        setStatus("");
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(
          msg.trimStart().startsWith("<!DOCTYPE") || msg.includes("<html")
            ? "無法載入後台摘要（請確認已登入，或將 NEXT_PUBLIC_API_BASE_URL 指向 FastAPI）。"
            : msg
        );
      });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const cards = [
    {
      label: "學生總數",
      value: Math.max(summaryValue(summary, ["students_total", "total_students", "students"]), students.length)
    },
    {
      label: "活躍學生",
      value: Math.max(summaryValue(summary, ["active_students", "students_active"]), students.filter((s) => s.remainingCredits > 0).length)
    },
    {
      label: "簽到次數",
      value: Math.max(summaryValue(summary, ["checkins_total", "checkins", "checkins_count"]), checkinsCount)
    },
    {
      label: "WhatsApp Logs",
      value: Math.max(summaryValue(summary, ["whatsapp_logs", "whatsapp_logs_count", "logs"]), whatsappLogs.length)
    },
    {
      label: "總支出 (HKD)",
      value: totalExpenses
    },
    {
      label: "課程總數",
      value: summaryValue(summary, ["courses", "courses_total", "total_courses"])
    }
  ];

  const onboardUrl = origin ? `${origin}/student/onboard` : "";
  const checkinUrl = origin ? `${origin}/student/checkin?from=qr` : "";
  const onboardQr = onboardUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(onboardUrl)}`
    : "";
  const checkinQr = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(checkinUrl)}`
    : "";

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7480/ingest/881a8b8b-14fd-4480-bb21-056e0c22cd5b", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "195967" },
      body: JSON.stringify({
        sessionId: "195967",
        runId: "pre-fix",
        hypothesisId: "H3,H4",
        location: "app/admin/page.tsx:AdminPage/useEffect",
        message: "Admin dashboard course management visibility",
        data: {
          cardLabels: cards.map((c) => c.label),
          summaryCourseCount: summaryValue(summary, ["courses", "courses_total", "total_courses"]),
          hasVisibleCourseManagementSection: false
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
  }, [summary, cards]);

  useEffect(() => {
    const section = document.querySelector("[data-course-management-section]");
    const style = section ? window.getComputedStyle(section) : null;
    // #region agent log
    fetch("http://127.0.0.1:7480/ingest/881a8b8b-14fd-4480-bb21-056e0c22cd5b", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "195967" },
      body: JSON.stringify({
        sessionId: "195967",
        runId: "post-fix",
        hypothesisId: "H3,H4",
        location: "app/admin/page.tsx:AdminPage/courseManagementDomProbe",
        message: "Course management section DOM visibility",
        data: {
          exists: Boolean(section),
          display: style?.display ?? null,
          text: section?.textContent?.slice(0, 160) ?? null
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
  }, []);

  async function downloadQrPdf(kind: "onboard" | "checkin") {
    try {
      const blob = await api.qrcodePdfBlob(kind, origin);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = kind === "onboard" ? "onboarding_qrcode.pdf" : "checkin_qrcode.pdf";
      a.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <BackendShell title="後台 Admin">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {status && <p className="rounded-md border border-[#3b2c14] bg-[#22190f] px-3 py-2 text-sm text-[#f9d28c]">{status}</p>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => (
            <article key={card.label} className="rounded-xl border border-white/[0.12] bg-[#111827] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <p className="text-[12px] tracking-[0.02em] text-slate-300">{card.label}</p>
              <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] text-white">{card.value}</p>
            </article>
          ))}
        </section>

        <section data-course-management-section className="rounded-2xl border border-white/[0.12] bg-[#111827] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-white">
                Course Management
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-300">
                建立 1:1 / 1:2 課程套餐、查看教練課表、簽到 QR 與堂數 ledger。
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              {summaryValue(summary, ["courses", "courses_total", "total_courses"])} courses
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Link
              href="/admin/branches"
              className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500/25"
            >
              分店管理
              <span className="mt-1 block text-xs font-normal text-amber-100/80">地址、營業時間、備註、CSV 匯入匯出</span>
            </Link>
            <Link
              href="/admin/course-set"
              className="rounded-xl border border-violet-400/40 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500/25"
            >
              Course 套餐開課
              <span className="mt-1 block text-xs font-normal text-violet-100/80">堂數 1–10、星期 tick、計算最後一堂日期</span>
            </Link>
            <Link
              href="/coach/calendar"
              className="rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500/25"
            >
              教練日程
              <span className="mt-1 block text-xs font-normal text-sky-100/80">月曆查看課堂與簽到</span>
            </Link>
            <Link
              href="/admin/attendance/session-ledger"
              className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500/25"
            >
              Session Ledger
              <span className="mt-1 block text-xs font-normal text-emerald-100/80">上堂、late cancel、補堂記錄</span>
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.12] bg-[#111827] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:p-6">
          <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-white">QR 功能中心</h2>
          <p className="mt-1 text-[13px] leading-5 text-slate-300">整合 Core 1（入職）與 Core 3（簽到）流程，統一深色容器。</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <article className="rounded-xl border border-white/[0.12] bg-[#0f172a] p-4">
              <h3 className="text-[15px] font-semibold leading-6 text-white">Core 1 · 數碼入職 QR</h3>
              <p className="mt-1 text-xs leading-5 text-slate-300">學生掃描後直接進入登記頁，系統自動派發 PIN。</p>
              {onboardQr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={onboardQr} alt="Onboarding QR" width={160} height={160} className="mt-3 rounded border border-white/[0.12]" />
              )}
              <button
                type="button"
                onClick={() => void downloadQrPdf("onboard")}
                className="mt-3 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm text-white transition hover:bg-[#6d28d9]"
              >
                匯出 onboarding PDF
              </button>
            </article>
            <article className="rounded-xl border border-white/[0.12] bg-[#0f172a] p-4">
              <h3 className="text-[15px] font-semibold leading-6 text-white">Core 3 · 簽到 QR</h3>
              <p className="mt-1 text-xs leading-5 text-slate-300">掃碼後直接進入簽到流程（姓名搜尋 + PIN 扣堂）。</p>
              {checkinQr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={checkinQr} alt="Check-in QR" width={160} height={160} className="mt-3 rounded border border-white/[0.12]" />
              )}
              <button
                type="button"
                onClick={() => void downloadQrPdf("checkin")}
                className="mt-3 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm text-white transition hover:bg-[#6d28d9]"
              >
                匯出 checkin PDF
              </button>
            </article>
          </div>
        </section>
      </div>
    </BackendShell>
  );
}
