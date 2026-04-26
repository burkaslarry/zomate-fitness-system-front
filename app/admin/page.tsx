"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackendShell from "../../components/backend-shell";
import { api } from "../../lib/api";

type Summary = Record<string, number>;

const QUICK_LINKS = [
  { href: "/admin/students", label: "學生管理" },
  { href: "/admin/onboarding-records", label: "入職紀錄 / 健康表單" },
  { href: "/admin/attendance/qr-console", label: "出勤 / 簽到管理" },
  { href: "/coach", label: "教練課表" },
  { href: "/admin/finance/sales", label: "銷售與分期" },
  { href: "/admin/finance/expenses", label: "支出管理" },
  { href: "/admin/finance/payroll", label: "薪酬 / 出勤報表" },
  { href: "/admin/settings/whatsapp", label: "WhatsApp API 狀態" },
  { href: "/admin/settings/disclaimer", label: "免責聲明內容設定" }
];

function summaryValue(summary: Summary, keys: string[]) {
  for (const key of keys) {
    if (typeof summary[key] === "number") return summary[key];
  }
  return 0;
}

export default function AdminPage() {
  const [summary, setSummary] = useState<Summary>({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    api
      .summary()
      .then((data) => setSummary(data as Summary))
      .catch((err) => setStatus(String(err)));
  }, []);

  const cards = [
    {
      label: "學生總數",
      value: summaryValue(summary, ["students_total", "total_students", "students"])
    },
    {
      label: "活躍學生",
      value: summaryValue(summary, ["active_students", "students_active"])
    },
    {
      label: "簽到次數",
      value: summaryValue(summary, ["checkins_total", "checkins", "checkins_count"])
    },
    {
      label: "WhatsApp Logs",
      value: summaryValue(summary, ["whatsapp_logs", "whatsapp_logs_count", "logs"])
    }
  ];

  return (
    <BackendShell title="後台 Admin">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {status && <p className="rounded-md border border-[#3b2c14] bg-[#22190f] px-3 py-2 text-sm text-[#f9d28c]">{status}</p>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="rounded-xl border border-[#333] bg-[#171717] p-5">
              <p className="text-sm text-[#a0a0a0]">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-[#333] bg-[#171717] p-5">
          <h2 className="mb-3 text-lg font-semibold text-white">功能入口</h2>
          <p className="mb-4 text-sm text-[#a0a0a0]">詳細功能請用左側主選單；此頁只保留 Dashboard Overview。</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-[#333] bg-[#141414] px-4 py-3 text-sm text-[#d8d8d8] transition hover:border-slate-500 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </BackendShell>
  );
}
