"use client";

/**
 * [F004][S002]
 * Feature: Admin Reports & Financials
 * Step: Reusable payment records table for student detail and global admin view
 */

import Link from "next/link";
import type { PaymentRecordRow } from "../types/api";
import { apiAssetUrl } from "../lib/api";
import { formatHktDateTime } from "../lib/format-hkt";
import WhatsAppButton from "./whatsapp-button";

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
  return formatHktDateTime(iso);
}

export default function PaymentRecordsTable({
  rows,
  showStudent = false,
  emptyText = "暫無付款紀錄。",
  onDelete,
  onRequestReceiptUpload,
  receiptUploadBusyId
}: {
  rows: PaymentRecordRow[];
  showStudent?: boolean;
  emptyText?: string;
  onDelete?: (row: PaymentRecordRow) => void | Promise<void>;
  /** [F005][S003] Opens wa.me with receipt-upload template for missing-receipt rows. */
  onRequestReceiptUpload?: (row: PaymentRecordRow) => void | Promise<void>;
  receiptUploadBusyId?: string | null;
}) {
  if (!rows.length) {
    return <p className="text-sm text-ink/55">{emptyText}</p>;
  }
  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {showStudent ? (
                  <>
                    <Link href={`/admin/students/${row.student_id}`} className="font-semibold text-ink underline">
                      {row.student_name}
                    </Link>
                    <p className="text-xs text-ink/50">{row.student_phone}</p>
                  </>
                ) : null}
                <p className={`text-sm text-ink/85 ${showStudent ? "mt-1" : ""}`}>{row.label}</p>
              </div>
              {statusBadge(row.status)}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink/70">
              <div>
                <dt className="text-ink/45">金額</dt>
                <dd className="font-medium text-ink">{row.amount != null ? `HKD ${row.amount}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-ink/45">方式</dt>
                <dd>{row.payment_method ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink/45">教練</dt>
                <dd>{row.coach_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink/45">日期</dt>
                <dd>{fmtDate(row.created_at)}</dd>
              </div>
            </dl>
            {row.receipt_url ? (
              <a
                href={apiAssetUrl(row.receipt_url) ?? row.receipt_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-primary underline"
              >
                查看收據
              </a>
            ) : null}
            {row.status === "missing_receipt" && onRequestReceiptUpload ? (
              <div className="mt-2">
                <WhatsAppButton
                  label={receiptUploadBusyId === row.id ? "產生中…" : "WhatsApp 請上傳收據"}
                  disabled={receiptUploadBusyId === row.id}
                  onClick={() => void onRequestReceiptUpload(row)}
                />
              </div>
            ) : null}
            {onDelete && (row.record_type === "renewal" || row.record_type === "receipt") ? (
              <button
                type="button"
                onClick={() => void onDelete(row)}
                className="mt-2 block text-xs font-medium text-rose-700 underline"
              >
                刪除紀錄
              </button>
            ) : null}
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm md:block">
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
              <th className="px-3 py-2">日期 (HKT)</th>
              {onDelete ? <th className="px-3 py-2">操作</th> : null}
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
                  ) : row.status === "missing_receipt" && onRequestReceiptUpload ? (
                    <WhatsAppButton
                      label={receiptUploadBusyId === row.id ? "…" : "請上傳收據"}
                      disabled={receiptUploadBusyId === row.id}
                      className="px-2 py-1 text-[10px]"
                      onClick={() => void onRequestReceiptUpload(row)}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtDate(row.created_at)}</td>
                {onDelete ? (
                  <td className="px-3 py-2">
                    {row.record_type === "renewal" || row.record_type === "receipt" ? (
                      <button
                        type="button"
                        onClick={() => void onDelete(row)}
                        className="text-xs font-medium text-rose-700 underline"
                      >
                        刪除
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
