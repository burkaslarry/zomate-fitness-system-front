"use client";

/**
 * [F004][S002]
 * Feature: Admin Reports & Financials
 * Step: Reusable payment records table for student detail and global admin view
 * Logic: Human-readable labels; optional 狀態/教練/收據 columns; row 詳情 modal.
 */

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, X } from "lucide-react";
import type { PaymentRecordRow } from "../types/api";
import { apiAssetUrl } from "../lib/api";
import { formatHktDateTime } from "../lib/format-hkt";
import WhatsAppButton from "./whatsapp-button";

type OptionalColumn = "status" | "coach" | "receipt";

const OPTIONAL_COLUMNS: { id: OptionalColumn; label: string }[] = [
  { id: "status", label: "狀態" },
  { id: "coach", label: "教練" },
  { id: "receipt", label: "收據" }
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "現金",
  fps: "轉數快 FPS",
  cheque: "支票",
  payme: "PayMe",
  bank_transfer: "銀行轉帳",
  mastercard: "Mastercard",
  visa: "Visa",
  credit_card_installment: "信用卡分期",
  amex: "Amex",
  unionpay: "銀聯"
};

function statusBadge(status: PaymentRecordRow["status"]) {
  if (status === "paid") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">已付</span>;
  }
  if (status === "missing_receipt") {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">缺收據</span>;
  }
  return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">待付</span>;
}

function recordTypeLabel(type: PaymentRecordRow["record_type"]): string {
  if (type === "renewal") return "續會";
  if (type === "receipt") return "收據";
  if (type === "installment") return "分期";
  return type;
}

/** Map machine codes / English sources to staff-facing Chinese. */
export function humanizePaymentLabel(raw: string | null | undefined): string {
  const text = String(raw ?? "").trim();
  if (!text) return "—";
  const upper = text.toUpperCase();
  if (upper === "RENEWAL" || upper === "RENEW") return "續會";
  if (upper === "REGISTER" || upper === "REGISTRATION" || upper === "NEW") return "新登記";

  const catMatch = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (catMatch) {
    const cat = catMatch[1].replace(/^Category:\s*/i, "").trim();
    const rest = catMatch[2].trim();
    return rest ? `${cat} · ${rest}` : cat || "—";
  }
  return text;
}

export function formatPaymentAmount(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  const n = Number(amount);
  return `HKD ${n.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "—";
  const key = method.trim().toLowerCase().replace(/\s+/g, "_");
  return PAYMENT_METHOD_LABELS[key] ?? method;
}

function fmtDate(iso: string) {
  return formatHktDateTime(iso);
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2 border-b border-ink/[0.06] py-2 text-sm last:border-b-0">
      <dt className="text-ink/50">{label}</dt>
      <dd className="min-w-0 break-words text-ink/90">{children}</dd>
    </div>
  );
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
  /** Optional columns hidden by default — toggle to show in grid. */
  const [visibleOptional, setVisibleOptional] = useState<Record<OptionalColumn, boolean>>({
    status: false,
    coach: false,
    receipt: false
  });
  const [detailRow, setDetailRow] = useState<PaymentRecordRow | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const showStatus = visibleOptional.status;
  const showCoach = visibleOptional.coach;
  const showReceipt = visibleOptional.receipt;

  const columnToggles = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
        <span className="font-medium text-ink/45">顯示欄位：</span>
        {OPTIONAL_COLUMNS.map((col) => {
          const on = visibleOptional[col.id];
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setVisibleOptional((prev) => ({ ...prev, [col.id]: !prev[col.id] }))}
              className={`rounded-full border px-2.5 py-1 transition ${
                on
                  ? "border-primary bg-primary/15 font-medium text-black"
                  : "border-ink/15 bg-canvas text-ink/65 hover:border-primary/30"
              }`}
            >
              {col.label}
            </button>
          );
        })}
      </div>
    ),
    [visibleOptional]
  );

  if (!rows.length) {
    return <p className="text-sm text-ink/55">{emptyText}</p>;
  }

  const detailModal =
    portalReady && detailRow
      ? createPortal(
          <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-ink/50 p-4"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDetailRow(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-record-detail-title"
              className="w-[min(92vw,28rem)] max-h-[85vh] overflow-y-auto rounded-xl border border-ink/15 bg-surface p-5 text-left shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="payment-record-detail-title" className="text-base font-semibold text-ink">
                    付款詳情
                  </h3>
                  <p className="mt-1 text-xs text-ink/55">{recordTypeLabel(detailRow.record_type)}</p>
                </div>
                <button
                  type="button"
                  aria-label="關閉"
                  className="rounded-md p-1 text-ink/50 hover:bg-canvas hover:text-ink"
                  onClick={() => setDetailRow(null)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <dl className="mt-3">
                {showStudent ? (
                  <DetailRow label="學員">
                    <Link
                      href={`/admin/students/${detailRow.student_id}`}
                      className="font-medium text-primary underline"
                    >
                      {detailRow.student_name}
                    </Link>
                    <span className="ml-2 text-ink/55">{detailRow.student_phone}</span>
                  </DetailRow>
                ) : null}
                <DetailRow label="項目">{humanizePaymentLabel(detailRow.label)}</DetailRow>
                <DetailRow label="金額">
                  <span className="font-semibold tabular-nums">{formatPaymentAmount(detailRow.amount)}</span>
                </DetailRow>
                <DetailRow label="方式">{formatPaymentMethod(detailRow.payment_method)}</DetailRow>
                <DetailRow label="狀態">{statusBadge(detailRow.status)}</DetailRow>
                <DetailRow label="教練">{detailRow.coach_name ?? "—"}</DetailRow>
                <DetailRow label="收據">
                  {detailRow.receipt_url ? (
                    <a
                      href={apiAssetUrl(detailRow.receipt_url) ?? detailRow.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary underline"
                    >
                      查看收據
                    </a>
                  ) : detailRow.status === "missing_receipt" ? (
                    "未上傳"
                  ) : (
                    "—"
                  )}
                </DetailRow>
                <DetailRow label="日期">{fmtDate(detailRow.created_at)}</DetailRow>
                {detailRow.due_date ? <DetailRow label="到期">{detailRow.due_date}</DetailRow> : null}
                {detailRow.paid_at ? <DetailRow label="已付於">{fmtDate(detailRow.paid_at)}</DetailRow> : null}
              </dl>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-ink/[0.06] pt-4">
                {detailRow.status === "missing_receipt" && onRequestReceiptUpload ? (
                  <WhatsAppButton
                    label={receiptUploadBusyId === detailRow.id ? "產生中…" : "WhatsApp 請上傳收據"}
                    disabled={receiptUploadBusyId === detailRow.id}
                    onClick={() => void onRequestReceiptUpload(detailRow)}
                  />
                ) : null}
                {onDelete &&
                (detailRow.record_type === "renewal" || detailRow.record_type === "receipt") ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onDelete(detailRow);
                      setDetailRow(null);
                    }}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700"
                  >
                    刪除
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black"
                  onClick={() => setDetailRow(null)}
                >
                  關閉
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="mb-3">{columnToggles}</div>

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
                <p className={`text-sm text-ink/85 ${showStudent ? "mt-1" : ""}`}>
                  {humanizePaymentLabel(row.label)}
                </p>
              </div>
              {showStatus ? statusBadge(row.status) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink/70">
              <div>
                <dt className="text-ink/45">金額</dt>
                <dd className="font-semibold tabular-nums text-ink">{formatPaymentAmount(row.amount)}</dd>
              </div>
              <div>
                <dt className="text-ink/45">方式</dt>
                <dd>{formatPaymentMethod(row.payment_method)}</dd>
              </div>
              {showCoach ? (
                <div>
                  <dt className="text-ink/45">教練</dt>
                  <dd>{row.coach_name ?? "—"}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-ink/45">日期</dt>
                <dd>{fmtDate(row.created_at)}</dd>
              </div>
            </dl>
            {showReceipt && row.receipt_url ? (
              <a
                href={apiAssetUrl(row.receipt_url) ?? row.receipt_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-medium text-primary underline"
              >
                查看收據
              </a>
            ) : null}
            {showReceipt && row.status === "missing_receipt" && onRequestReceiptUpload ? (
              <div className="mt-2">
                <WhatsAppButton
                  label={receiptUploadBusyId === row.id ? "產生中…" : "WhatsApp 請上傳收據"}
                  disabled={receiptUploadBusyId === row.id}
                  onClick={() => void onRequestReceiptUpload(row)}
                />
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDetailRow(row)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                詳情
              </button>
              {onDelete && (row.record_type === "renewal" || row.record_type === "receipt") ? (
                <button
                  type="button"
                  onClick={() => void onDelete(row)}
                  className="text-xs font-medium text-rose-700 underline"
                >
                  刪除
                </button>
              ) : null}
            </div>
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
              {showStatus ? <th className="px-3 py-2">狀態</th> : null}
              {showCoach ? <th className="px-3 py-2">教練</th> : null}
              {showReceipt ? <th className="px-3 py-2">收據</th> : null}
              <th className="px-3 py-2">日期 (HKT)</th>
              <th className="px-3 py-2">操作</th>
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
                <td className="px-3 py-2">{humanizePaymentLabel(row.label)}</td>
                <td className="px-3 py-2 whitespace-nowrap font-medium tabular-nums">
                  {formatPaymentAmount(row.amount)}
                </td>
                <td className="px-3 py-2">{formatPaymentMethod(row.payment_method)}</td>
                {showStatus ? <td className="px-3 py-2">{statusBadge(row.status)}</td> : null}
                {showCoach ? <td className="px-3 py-2">{row.coach_name ?? "—"}</td> : null}
                {showReceipt ? (
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
                ) : null}
                <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtDate(row.created_at)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailRow(row)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary underline"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      詳情
                    </button>
                    {onDelete && (row.record_type === "renewal" || row.record_type === "receipt") ? (
                      <button
                        type="button"
                        onClick={() => void onDelete(row)}
                        className="text-xs font-medium text-rose-700 underline"
                      >
                        刪除
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailModal}
    </>
  );
}
