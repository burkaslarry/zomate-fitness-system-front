"use client";

/**
 * [F004][S008]
 * Feature: Admin Reports & Financials
 * Step: 分期付款學生 board
 * Logic: Same ledger as dashboard 跟進分期 (course segments + category plans), so counts match 付款紀錄.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import { formatHktDateTime } from "../../../lib/format-hkt";
import type {
  InstallmentLedgerPeriod,
  InstallmentLedgerResponse,
  InstallmentLedgerRow,
  InstallmentLedgerSummary
} from "../../../types/api";

const EMPTY_SUMMARY: InstallmentLedgerSummary = {
  students_total: 0,
  students_unpaid: 0,
  periods_total: 0,
  periods_unpaid: 0,
  periods_paid: 0,
  outstanding_amount: 0
};

/** [F004][S008] Common methods for the proof-upload form (free text is stored as-is). */
const PROOF_METHODS = [
  { value: "fps", label: "轉數快 FPS" },
  { value: "bank_transfer", label: "銀行轉帳" },
  { value: "payme", label: "PayMe" },
  { value: "cash", label: "現金" }
];

type ProofTarget = { rowId: string; period: InstallmentLedgerPeriod };

function money(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `HKD ${value.toLocaleString("zh-HK")}`;
}

function progressPct(row: InstallmentLedgerRow): number {
  if (row.total_installments <= 0) return 0;
  return Math.min(100, Math.round((row.paid_installments / row.total_installments) * 100));
}

export default function AdminInstallmentsPage() {
  const [rows, setRows] = useState<InstallmentLedgerRow[]>([]);
  const [summary, setSummary] = useState<InstallmentLedgerSummary>(EMPTY_SUMMARY);
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proofTarget, setProofTarget] = useState<ProofTarget | null>(null);
  const [proofAmount, setProofAmount] = useState("");
  const [proofMethod, setProofMethod] = useState(PROOF_METHODS[0].value);
  const [proofNote, setProofNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofNotice, setProofNotice] = useState<{ rowId: string; text: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.installments({ only_unpaid: onlyUnpaid })) as InstallmentLedgerResponse;
      setRows(Array.isArray(res.rows) ? res.rows : []);
      setSummary(res.summary ?? EMPTY_SUMMARY);
    } catch (e) {
      alertApiError(e);
      setRows([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [onlyUnpaid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openProof(row: InstallmentLedgerRow, period: InstallmentLedgerPeriod) {
    setProofTarget({ rowId: row.id, period });
    setProofAmount(period.amount != null ? String(period.amount) : "");
    setProofMethod(PROOF_METHODS[0].value);
    setProofNote("");
    setProofFile(null);
    setProofNotice(null);
  }

  /**
   * [F004][S008]
   * Feature: Installment proof upload
   * Step: Admin uploads 第二／第三期 payment record + proof before confirmation
   * Logic: POST /api/members/by-id/{id}/receipts with installment scope — evidence only (payment_confirmed=false).
   */
  async function submitProof() {
    if (!proofTarget || proofBusy) return;
    const row = rows.find((r) => r.id === proofTarget.rowId);
    if (!row) return;
    if (!proofFile) {
      setProofNotice({ rowId: row.id, text: "請先選擇付款證明（收據／截圖 PDF 或相片）。" });
      return;
    }
    if (row.source === "course" && !row.course_enrollment_id) {
      setProofNotice({ rowId: row.id, text: "此課程未有 Course 記錄，請到付款紀錄處理。" });
      return;
    }
    if (row.source === "category" && !row.installment_plan_id) {
      setProofNotice({ rowId: row.id, text: "此類別分期未有計劃記錄，請到付款紀錄處理。" });
      return;
    }
    setProofBusy(true);
    try {
      await api.uploadMemberReceiptById(row.student_id, {
        file: proofFile,
        amount: proofAmount.trim() || undefined,
        payment_method: proofMethod,
        note: proofNote.trim() || undefined,
        context: `分期付款證明上傳（第 ${proofTarget.period.installment_no} 期）`,
        source: "RENEWAL",
        installment_no: proofTarget.period.installment_no,
        course_enrollment_id: row.course_enrollment_id ?? undefined,
        installment_plan_id: row.installment_plan_id ?? undefined,
        send_whatsapp: false,
        notify_coach: false
      });
      console.log("[F004][S008] Success: Installment proof uploaded", {
        studentId: row.student_id,
        installmentNo: proofTarget.period.installment_no,
        source: row.source
      });
      setProofNotice({
        rowId: row.id,
        text: `第 ${proofTarget.period.installment_no} 期付款證明已上傳（待確認收款）。`
      });
      setProofTarget(null);
      setProofFile(null);
      await reload();
    } catch (e) {
      alertApiError(e);
      console.error("[F004][S008] Error: Installment proof upload failed.");
    } finally {
      setProofBusy(false);
    }
  }

  return (
    <BackendShell title="分期付款學生">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-ink sm:text-2xl">分期付款學生</h2>
          <p className="mt-1 text-sm text-ink/65">
            同一份分期 ledger 計算後台「跟進分期」數字：課程分期（每期 PIN）＋類別分期計劃，期數與金額與付款紀錄一致。
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
            <dt className="text-[11px] text-ink/55 sm:text-xs">分期學生（未付清 / 總數）</dt>
            <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
              {summary.students_unpaid}
              <span className="mx-1 font-normal text-ink/35">/</span>
              {summary.students_total}
            </dd>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
            <dt className="text-[11px] text-ink/55 sm:text-xs">跟進期數（未跟進 / 總期數）</dt>
            <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
              {summary.periods_unpaid}
              <span className="mx-1 font-normal text-ink/35">/</span>
              {summary.periods_total}
            </dd>
          </div>
          <div className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm sm:p-4">
            <dt className="text-[11px] text-ink/55 sm:text-xs">未收分期金額</dt>
            <dd className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-ink sm:text-[28px]">
              {money(summary.outstanding_amount)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-ink/75">
            <input
              type="checkbox"
              checked={onlyUnpaid}
              onChange={(e) => setOnlyUnpaid(e.target.checked)}
              className="h-4 w-4 rounded border-ink/30"
            />
            只顯示未付清
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink/50">
              已收期數 {summary.periods_paid} / {summary.periods_total}
            </span>
            <Link
              href="/admin/payments"
              className="rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-primary/40"
            >
              付款紀錄
            </Link>
          </div>
        </div>

        {loading ? <p className="text-sm text-ink/55">載入中…</p> : null}

        {!loading && rows.length === 0 ? (
          <p className="rounded-xl border border-ink/10 bg-surface px-4 py-6 text-center text-sm text-ink/55">
            {onlyUnpaid ? "所有分期計劃均已付清。" : "暫時沒有分期付款的學生。"}
          </p>
        ) : null}

        <ul className="space-y-3">
          {rows.map((row) => {
            const pct = progressPct(row);
            const cleared = row.unpaid_installments === 0;
            return (
              <li key={row.id} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/students/${row.student_id}`}
                        className="text-[15px] font-semibold text-ink underline decoration-ink/20 hover:decoration-ink"
                      >
                        {row.student_name}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          cleared
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {cleared ? "已付清" : "未付清"}
                      </span>
                      <span className="rounded-full border border-ink/12 bg-canvas px-2 py-0.5 text-[11px] text-ink/60">
                        {row.source === "course" ? "課程分期" : "類別分期"}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-ink/70">
                      {row.label}
                      {row.branch_name || row.branch_code ? (
                        <span className="text-ink/45"> · {row.branch_name ?? row.branch_code}</span>
                      ) : null}
                      {row.coach_name ? <span className="text-ink/45"> · 教練 {row.coach_name}</span> : null}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink/50">{row.student_phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-medium tabular-nums text-ink">
                      {row.paid_installments} / {row.total_installments} 期
                    </p>
                    <p className="mt-0.5 text-[12px] tabular-nums text-ink/60">
                      未收 {money(row.outstanding_amount)}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                    <div
                      className={`h-full rounded-full ${cleared ? "bg-emerald-500/80" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[11px] text-ink/55">
                    <span>
                      已收 {money(row.paid_amount)} · 總額 {money(row.total_amount)}
                    </span>
                    <span>
                      {row.next_installment_no != null ? (
                        <>
                          下一期：第 {row.next_installment_no} 期
                          {row.next_due_date ? ` · 到期 ${row.next_due_date}` : ""}
                        </>
                      ) : (
                        "所有期數已付清"
                      )}
                    </span>
                  </div>
                </div>

                <details className="mt-3 rounded-lg border border-ink/10 bg-canvas/60">
                  <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-ink/70">
                    期數詳情（{row.total_installments} 期）
                  </summary>
                  <ul className="divide-y divide-ink/8 px-3 pb-2">
                    {row.periods.map((period) => (
                      <li
                        key={period.installment_no}
                        className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-[12px]"
                      >
                        <span className="font-medium text-ink/80">第 {period.installment_no} 期</span>
                        <span className="tabular-nums text-ink/65">{money(period.amount)}</span>
                        <span className="text-ink/50">
                          {period.lesson_from != null && period.lesson_to != null
                            ? `第 ${period.lesson_from}–${period.lesson_to} 堂`
                            : ""}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            period.paid
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {period.paid ? "已付款" : "未付款"}
                        </span>
                        <span className="text-[11px] text-ink/45">
                          {period.paid
                            ? period.paid_at
                              ? formatHktDateTime(period.paid_at)
                              : "已付款"
                            : period.due_date
                              ? `到期 ${period.due_date}`
                              : ""}
                        </span>
                        {!period.paid ? (
                          <button
                            type="button"
                            onClick={() => openProof(row, period)}
                            className="rounded-md border border-primary/45 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-ink hover:bg-primary/20"
                          >
                            上傳付款證明
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>

                {proofTarget?.rowId === row.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitProof();
                    }}
                    className="mt-3 space-y-2 rounded-lg border border-primary/30 bg-canvas p-3"
                  >
                    <p className="text-[12px] font-medium text-ink">
                      第 {proofTarget.period.installment_no} 期付款紀錄
                      <span className="ml-2 font-normal tabular-nums text-ink/60">
                        {money(proofTarget.period.amount)}
                      </span>
                    </p>
                    <label className="block text-[12px] text-ink/75">
                      付款證明（收據／截圖，PDF 或相片）
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                        className="mt-1 block w-full rounded border border-ink/20 bg-surface p-1.5 text-[12px]"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <label className="block text-[12px] text-ink/75">
                        金額 HKD
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={proofAmount}
                          onChange={(e) => setProofAmount(e.target.value)}
                          className="mt-1 block w-32 rounded border border-ink/20 bg-surface px-2 py-1 text-[12px]"
                        />
                      </label>
                      <label className="block text-[12px] text-ink/75">
                        付款方式
                        <select
                          value={proofMethod}
                          onChange={(e) => setProofMethod(e.target.value)}
                          className="mt-1 block rounded border border-ink/20 bg-surface px-2 py-1 text-[12px]"
                        >
                          {PROOF_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block min-w-[10rem] flex-1 text-[12px] text-ink/75">
                        備註
                        <input
                          type="text"
                          maxLength={200}
                          value={proofNote}
                          onChange={(e) => setProofNote(e.target.value)}
                          className="mt-1 block w-full rounded border border-ink/20 bg-surface px-2 py-1 text-[12px]"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="submit"
                        disabled={proofBusy}
                        className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-black disabled:opacity-50"
                      >
                        {proofBusy ? "上傳中…" : "上傳付款證明"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProofTarget(null)}
                        disabled={proofBusy}
                        className="rounded-lg border border-ink/15 bg-surface px-3 py-1.5 text-[12px] text-ink/70"
                      >
                        取消
                      </button>
                      <span className="text-[11px] text-ink/50">
                        只作付款紀錄證明，確認收款後才解鎖 PIN。
                      </span>
                    </div>
                  </form>
                ) : null}

                {proofNotice?.rowId === row.id ? (
                  <p className="mt-2 text-[12px] text-emerald-700">{proofNotice.text}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-medium">
                  <Link href={`/admin/students/${row.student_id}`} className="text-primary hover:underline">
                    學員詳情 →
                  </Link>
                  <Link
                    href={`/admin/payments?q=${encodeURIComponent(row.student_phone)}`}
                    className="text-ink/60 hover:text-ink hover:underline"
                  >
                    付款紀錄 →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </BackendShell>
  );
}
