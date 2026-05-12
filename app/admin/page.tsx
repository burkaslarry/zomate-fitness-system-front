"use client";

/*
 * Features F015:AdminDashboardSurface -- KPI cards, course hub, QR blocks use canvas/surface/primary tokens (no slate-900 shell).
 */

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

type DashboardCard =
  | { kind: "number"; label: string; value: number }
  | {
      kind: "ratio";
      label: string;
      detail: string;
      unpaid: number;
      total: number;
      ratioHint: string;
      href: string;
    };

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

  const installmentUnpaid = summaryValue(summary, ["installment_students_unpaid", "students_installment_pending"]);
  const installmentTotal = summaryValue(summary, ["installment_students_total", "students_installment_active"]);

  const cards: DashboardCard[] = [
    {
      kind: "number",
      label: "學生總數",
      value: Math.max(summaryValue(summary, ["students_total", "total_students", "students"]), students.length)
    },
    {
      kind: "number",
      label: "活躍學生",
      value: Math.max(summaryValue(summary, ["active_students", "students_active"]), students.filter((s) => s.remainingCredits > 0).length)
    },
    {
      kind: "number",
      label: "簽到次數",
      value: Math.max(summaryValue(summary, ["checkins_total", "checkins", "checkins_count"]), checkinsCount)
    },
    {
      kind: "number",
      label: "WhatsApp Logs",
      value: Math.max(summaryValue(summary, ["whatsapp_logs", "whatsapp_logs_count", "logs"]), whatsappLogs.length)
    },
    {
      kind: "number",
      label: "總支出 (HKD)",
      value: totalExpenses
    },
    {
      kind: "number",
      label: "課程總數",
      value: summaryValue(summary, ["courses", "courses_total", "total_courses"])
    },
    {
      kind: "ratio",
      label: "跟進分期付款",
      detail: "類別報名 installment（進行中） · 按此去銷售與分期",
      unpaid: installmentUnpaid,
      total: installmentTotal,
      ratioHint: "左：仲有分期未俾清 · 右：做緊分期學生人數",
      href: "/admin/finance/sales?installment_enrollment=1"
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
        {status && (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-ink">{status}</p>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {cards.map((card) => {
            const shell = (
              <>
                <p className="text-[12px] tracking-[0.02em] text-ink/60">{card.label}</p>
                {card.kind === "number" ? (
                  <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">{card.value}</p>
                ) : (
                  <>
                    <p className="mt-2 text-[28px] font-semibold tabular-nums leading-none tracking-[-0.02em] text-ink">
                      <span>{card.unpaid}</span>
                      <span className="mx-1.5 font-normal text-ink/35">/</span>
                      <span>{card.total}</span>
                    </p>
                    <p className="mt-2 text-[11px] leading-4 text-ink/55">{card.ratioHint}</p>
                    <p className="mt-1 text-[11px] leading-4 text-ink/45">{card.detail}</p>
                    <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary">
                      <span aria-hidden>→</span> 銷售與分期
                    </p>
                  </>
                )}
              </>
            );

            if (card.kind === "ratio") {
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className={`rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04] transition hover:border-primary/45 hover:ring-primary/20 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                >
                  {shell}
                </Link>
              );
            }

            return (
              <article
                key={card.label}
                className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04]"
              >
                {shell}
              </article>
            );
          })}
        </section>

        <section
          data-course-management-section
          className="rounded-2xl border-2 border-primary/25 bg-canvas p-5 shadow-sm md:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">Course Management</h2>
              <p className="mt-1 text-[13px] leading-5 text-ink/70">
                建立 1:1 / 1:2 課程套餐、查看教練課表、簽到 QR 與堂數 ledger。
              </p>
            </div>
            <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-medium text-ink">
              {summaryValue(summary, ["courses", "courses_total", "total_courses"])} courses
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Link
              href="/admin/branches"
              className="rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/[0.04] hover:bg-amber-100/90"
            >
              分店管理
              <span className="mt-1 block text-xs font-normal text-ink/65">地址、營業時間、備註、CSV 匯入匯出</span>
            </Link>
            <Link
              href="/admin/course-set"
              className="rounded-xl border border-violet-200/70 bg-violet-50/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/[0.04] hover:bg-violet-100/90"
            >
              Course 套餐開課
              <span className="mt-1 block text-xs font-normal text-ink/65">堂數 1–10、星期 tick、計算最後一堂日期</span>
            </Link>
            <Link
              href="/coach/calendar"
              className="rounded-xl border border-sky-200/70 bg-sky-50/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/[0.04] hover:bg-sky-100/90"
            >
              教練日程
              <span className="mt-1 block text-xs font-normal text-ink/65">月曆查看課堂與簽到</span>
            </Link>
            <Link
              href="/admin/attendance/session-ledger"
              className="rounded-xl border border-emerald-200/70 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-ink/[0.04] hover:bg-emerald-100/90"
            >
              Session Ledger · 扣堂原因
              <span className="mt-1 block text-xs font-normal text-ink/65">上堂、late cancel、補堂記錄</span>
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border-2 border-ink/10 bg-surface p-5 shadow-sm md:p-6">
          <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">QR 功能中心</h2>
          <p className="mt-1 text-[13px] leading-5 text-ink/70">
            整合 Core 1（入職）與 Core 3（簽到）流程；版面與左側選單同一暖色調。
          </p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <article className="rounded-xl border border-ink/10 bg-canvas p-4 shadow-sm ring-1 ring-primary/10">
              <h3 className="text-[15px] font-semibold leading-6 text-ink">Core 1 · 數碼入職 QR</h3>
              <p className="mt-1 text-xs leading-5 text-ink/65">學生掃描後直接進入登記頁，系統自動派發 PIN。</p>
              {onboardQr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={onboardQr}
                  alt="Onboarding QR"
                  width={160}
                  height={160}
                  className="mt-3 rounded-lg border border-ink/10 bg-white p-2 shadow-sm"
                />
              )}
              <button
                type="button"
                onClick={() => void downloadQrPdf("onboard")}
                className="mt-3 rounded-lg border border-ink/10 bg-primary px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-primary/90"
              >
                匯出 onboarding PDF
              </button>
            </article>
            <article className="rounded-xl border border-ink/10 bg-canvas p-4 shadow-sm ring-1 ring-primary/10">
              <h3 className="text-[15px] font-semibold leading-6 text-ink">Core 3 · 簽到 QR</h3>
              <p className="mt-1 text-xs leading-5 text-ink/65">掃碼後直接進入簽到流程（姓名搜尋 + PIN 扣堂）。</p>
              {checkinQr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={checkinQr}
                  alt="Check-in QR"
                  width={160}
                  height={160}
                  className="mt-3 rounded-lg border border-ink/10 bg-white p-2 shadow-sm"
                />
              )}
              <button
                type="button"
                onClick={() => void downloadQrPdf("checkin")}
                className="mt-3 rounded-lg border border-ink/10 bg-primary px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-primary/90"
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
