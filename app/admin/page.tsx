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

  useEffect(() => {
    api
      .summary()
      .then((data) => setSummary(data as Summary))
      .catch((err) => setStatus(String(err)));
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

  return (
    <BackendShell title="後台 Admin">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {status && <p className="rounded-md border border-[#3b2c14] bg-[#22190f] px-3 py-2 text-sm text-[#f9d28c]">{status}</p>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <article key={card.label} className="rounded-xl border border-[#333] bg-[#171717] p-5">
              <p className="text-sm text-[#a0a0a0]">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
            </article>
          ))}
        </section>
      </div>
    </BackendShell>
  );
}
