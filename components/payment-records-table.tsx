"use client";

/**
 * [F004][S002]
 * Feature: Admin Reports & Financials
 * Step: Reusable payment records table for student detail and global admin view
 */

import Link from "next/link";
import type { PaymentRecordRow } from "../types/api";
import { apiAssetUrl } from "../lib/api";

function statusBadge(status: PaymentRecordRow["status"]) {
  if (status === "paid") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">已付</span>;
  }
  if (status === "missing_receipt") {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">缺收據</span>;
  }
  return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">待付</span>;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-HK", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function PaymentRecordsTable({
  rows,
  showStudent = false,
  emptyText = "暫無付款紀錄。"
}: {
  rows: PaymentRecordRow[];
  showStudent?: boolean;
  emptyText?: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-ink/55">{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-ink/10 bg-canvas/80 text-xs text-ink/60">
          <tr>
            {showStudent ? <th className="px-3 py-2">學員</th> : null}
            <th className="px-3 py-2">項目</th>
            <th className="px-3 py-2">金額</th>
            <th className="px-3 py-2">方式</th>
            <th className="px-3 py-2">狀態</th>
            <th className="px-3 py-2">教練</th>
            <th className="px-3 py-2">收據</th>
            <th className="px-3 py-2">日期</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-ink/[0.06] text-ink/85">
              {showStudent ? (
                <td className="px-3 py-2">
                  <Link href={`/admin/students/${row.student_id}`} className="font-medium text-ink underline">
                    {row.student_name}
                  </Link>
                  <div className="text-xs text-ink/50">{row.student_phone}</div>
                </td>
              ) : null}
              <td className="px-3 py-2">{row.label}</td>
              <td className="px-3 py-2 whitespace-nowrap">{row.amount != null ? `HKD ${row.amount}` : "—"}</td>
              <td className="px-3 py-2">{row.payment_method ?? "—"}</td>
              <td className="px-3 py-2">{statusBadge(row.status)}</td>
              <td className="px-3 py-2">{row.coach_name ?? "—"}</td>
              <td className="px-3 py-2">
                {row.receipt_url ? (
                  <a
                    href={apiAssetUrl(row.receipt_url) ?? row.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline"
                  >
                    查看
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtDate(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
