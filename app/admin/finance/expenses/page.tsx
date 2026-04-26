"use client";

import { FormEvent, useState } from "react";
import BackendShell from "../../../../components/backend-shell";
import { useDemoState } from "../../../../lib/demo-state";

export default function AdminFinanceExpensesPage() {
  const { expenses, addExpense, totalExpenses } = useDemoState();
  const [status, setStatus] = useState("");

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const category = String(form.get("category")) as "Rent" | "Staff" | "Utilities" | "Equipment" | "Other";
    const amount = Number(form.get("amount"));
    const date = String(form.get("date"));
    if (!amount || amount <= 0) {
      setStatus("請輸入有效金額。");
      return;
    }
    addExpense({ category, amount, date, receiptImage: "mock://receipt-preview.png" });
    setStatus("已加入支出，Dashboard 會即時更新。");
    e.currentTarget.reset();
  }

  function exportExpensesCsv() {
    const header = "category,amount,date\n";
    const rows = expenses.map((item) => `${item.category},${item.amount},${item.date}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <BackendShell title="支出管理">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">支出管理 (Expense Tracking)</h2>
        <p className="text-sm text-slate-400">Demo 版頁面：給 Fung 入單、標記支出類型、生成月度支出報告。</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportExpensesCsv}>
            匯出 expenses.csv
          </button>
          <label className="cursor-pointer rounded-md border border-[#333] px-3 py-2 text-sm text-slate-200">
            匯入 CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const count = Math.max(0, text.split("\n").length - 1);
                setStatus(`已讀取 ${count} 筆支出資料（Demo 預覽）`);
                ev.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="rounded-md border border-[#333] bg-[#171717] px-3 py-2 text-sm text-slate-200">Total Expenses: HKD {totalExpenses.toLocaleString()}</p>
        <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-[#333] bg-[#171717] p-4 md:grid-cols-4">
          <select name="category" className="md:col-span-1" defaultValue="Rent">
            <option value="Rent">Rent</option>
            <option value="Staff">Staff</option>
            <option value="Utilities">Utilities</option>
            <option value="Equipment">Equipment</option>
            <option value="Other">Other</option>
          </select>
          <input name="amount" type="number" min={1} placeholder="Amount" className="md:col-span-1" required />
          <input name="date" type="date" className="md:col-span-1" required />
          <button type="submit" className="md:col-span-1">
            新增支出
          </button>
        </form>
        {status && <p className="text-sm text-emerald-300">{status}</p>}
        <div className="space-y-2 rounded-xl border border-[#333] bg-[#171717] p-4">
          {expenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between rounded bg-[#141414] px-3 py-2 text-sm">
              <span>
                {expense.category} · {expense.date}
              </span>
              <span>HKD {expense.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </BackendShell>
  );
}
