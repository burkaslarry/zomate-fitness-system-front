"use client";

import { FormEvent, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { api } from "../../../lib/api";
import type { FinanceSummary } from "../../../types/api";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminFinancePage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<FinanceSummary | null>(null);

  async function load() {
    setData((await api.financeSummary({ from, to })) as FinanceSummary);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.createExpense({
      date: form.get("date"),
      category: form.get("category"),
      amount: Number(form.get("amount")),
      note: form.get("note")
    });
    event.currentTarget.reset();
    await load();
  }

  function exportCsv() {
    if (!data) return;
    const csv = ["metric,value", `total_income,${data.total_income}`, `total_expense,${data.total_expense}`, `net,${data.net}`, `txn_count,${data.txn_count}`].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-summary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <BackendShell title="財務">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink" />
          <button onClick={() => void load()} className="rounded-lg border border-ink/15 bg-primary/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-primary">更新</button>
          <button onClick={exportCsv} className="rounded-lg border border-ink/10 px-4 py-2 text-sm text-ink">Export CSV</button>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["總收入", data?.total_income ?? 0],
            ["總支出", data?.total_expense ?? 0],
            ["淨收入", data?.net ?? 0],
            ["交易數", data?.txn_count ?? 0]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-4">
              <p className="text-xs text-ink/55">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Breakdown title="Payment method" rows={data?.by_payment_method ?? []} />
          <Breakdown title="Branch" rows={data?.by_branch ?? []} />
          <Breakdown title="Coach" rows={data?.by_coach ?? []} />
        </div>
        <section className="h-72 rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-4">
          <h3 className="mb-3 font-semibold text-ink">Daily income</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data?.daily_income ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,36,34,0.08)" />
              <XAxis dataKey="date" stroke="#6b5f5c" fontSize={12} />
              <YAxis stroke="#6b5f5c" fontSize={12} />
              <Tooltip />
              <Bar dataKey="amount" fill="#E8A598" />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-5">
          <h3 className="font-semibold text-ink">Manual expense</h3>
          <form onSubmit={addExpense} className="mt-3 grid gap-3 md:grid-cols-5">
            <input name="date" type="date" defaultValue={today()} className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink" />
            <select name="category" className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink">
              <option value="rent">rent</option>
              <option value="salary">salary</option>
              <option value="supplies">supplies</option>
              <option value="other">other</option>
            </select>
            <input name="amount" required inputMode="decimal" placeholder="金額" className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink" />
            <input name="note" placeholder="備註" className="rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-ink" />
            <button className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-sm font-semibold text-ink hover:bg-emerald-100">新增</button>
          </form>
        </section>
      </div>
    </BackendShell>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ key: string; amount: number }> }) {
  return (
    <section className="rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04] p-4">
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="mt-3 space-y-2 text-sm text-ink/80">
        {rows.map((row) => <div key={row.key} className="flex justify-between"><span>{row.key}</span><span>{row.amount}</span></div>)}
      </div>
    </section>
  );
}
