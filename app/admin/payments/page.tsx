"use client";

/**
 * [F004][S002]
 * Feature: Admin Reports & Financials
 * Step: Global payment records panel — search and filter by status
 */

import { useCallback, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import PaymentRecordsTable from "../../../components/payment-records-table";
import { alertApiError, api } from "../../../lib/api";
import type { PaymentRecordRow } from "../../../types/api";

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "paid", label: "已付" },
  { value: "outstanding", label: "待付" },
  { value: "missing_receipt", label: "缺收據" }
] as const;

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<PaymentRecordRow[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const seeded = params.get("status");
    if (seeded) setStatus(seeded);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.paymentRecords({
        status: status || undefined,
        q: search.trim() || undefined
      })) as { records?: PaymentRecordRow[] };
      setRows(Array.isArray(res.records) ? res.records : []);
    } catch (e) {
      alertApiError(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <BackendShell title="付款紀錄">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h2 className="text-2xl font-semibold text-ink">付款紀錄 Payment Records</h2>
          <p className="mt-1 text-sm text-ink/65">
            全館學員交易、續會、收據與分期紀錄。可篩選缺收據／待付／已付。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋學員姓名 / 電話 / 項目"
            className="min-w-[220px] flex-1 rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg bg-primary/90 px-4 py-2 text-sm font-semibold text-ink"
          >
            搜尋
          </button>
        </div>
        {loading ? <p className="text-sm text-ink/55">載入中…</p> : null}
        <PaymentRecordsTable rows={rows} showStudent emptyText="沒有符合條件的付款紀錄。" />
      </div>
    </BackendShell>
  );
}
