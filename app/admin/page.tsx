"use client";

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
        {status && <p className="rounded-md border border-[#3b2c14] bg-[#22190f] px-3 py-2 text-sm text-[#f9d28c]">{status}</p>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <article key={card.label} className="rounded-xl border border-white/[0.12] bg-[#111827] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <p className="text-[12px] tracking-[0.02em] text-slate-300">{card.label}</p>
              <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] text-white">{card.value}</p>
            </article>
          ))}
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
