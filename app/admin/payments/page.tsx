"use client";

/**
 * [F004][S002]
 * Feature: Admin Reports & Financials
 * Step: Global payment records panel — search, filter, CSV/ZIP import-export
 */

import { useCallback, useEffect, useRef, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import PaymentRecordsTable from "../../../components/payment-records-table";
import { alertApiError, api, downloadBlobFile, downloadCsv, uploadCsv } from "../../../lib/api";
import { openWhatsAppLink } from "../../../lib/whatsapp-utils";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [receiptUploadBusyId, setReceiptUploadBusyId] = useState<string | null>(null);
  const [ioStatus, setIoStatus] = useState("");
  const importRef = useRef<HTMLInputElement | null>(null);

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

  function exportQuery(): string {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (search.trim()) sp.set("q", search.trim());
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
  }

  async function onExportCsv() {
    setIoStatus("匯出 CSV…");
    try {
      await downloadCsv(`/api/admin/payment-records/export.csv${exportQuery()}`, "payment-records.csv");
      setIoStatus("已匯出付款紀錄 CSV（含詳情欄）。");
      console.log("[F004][S002] Success: payment records CSV exported");
    } catch (e) {
      alertApiError(e);
      setIoStatus("");
    }
  }

  async function onExportFungCsv() {
    setIoStatus("匯出 Fung CSV…");
    try {
      await downloadCsv(
        `/api/admin/payment-records/export.fung.csv${exportQuery()}`,
        "payment-records-fung.csv"
      );
      setIoStatus("已匯出 Fung 收錢格式 CSV（可直接再匯入）。");
      console.log("[F004][S002] Success: Fung payment CSV exported");
    } catch (e) {
      alertApiError(e);
      setIoStatus("");
    }
  }

  async function onExportZip() {
    setIoStatus("匯出 ZIP（CSV + 收據資料夾）…");
    try {
      await downloadBlobFile(
        `/api/admin/payment-records/export.zip${exportQuery()}`,
        "payment-records-export.zip"
      );
      setIoStatus("已匯出 ZIP：payment-records.csv + receipts/ 照片／PDF。");
      console.log("[F004][S002] Success: payment records ZIP exported");
    } catch (e) {
      alertApiError(e);
      setIoStatus("");
    }
  }

  async function onImportFile(f: File | null) {
    if (!f) return;
    setIoStatus("匯入中…");
    try {
      const res = await uploadCsv("/api/admin/payment-records/import", f);
      setIoStatus(
        `匯入完成：新增 ${res.imported ?? 0}，更新 ${res.updated ?? 0}，收據檔 ${res.receipts_saved ?? 0}，略過 ${res.skipped ?? 0}`
      );
      console.log("[F004][S002] Success: payment records imported", res);
      await reload();
    } catch (e) {
      alertApiError(e);
      setIoStatus("");
      console.error("[F004][S002] Error: payment records import failed.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function handleDelete(row: PaymentRecordRow) {
    if (row.record_type !== "renewal" && row.record_type !== "receipt") return;
    const label = `${row.student_name} · ${row.label}`;
    const reverse =
      row.record_type === "renewal"
        ? window.confirm(
            `確定刪除付款紀錄？\n${label}\n\n將一併扣回此筆續會加上的堂數（如有）。`
          )
        : window.confirm(`確定刪除收據紀錄？\n${label}`);
    if (!reverse) return;
    setDeletingId(row.id);
    try {
      await api.deletePaymentRecord(row.record_type, row.ref_id, row.record_type === "renewal");
      await reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRequestReceiptUpload(row: PaymentRecordRow) {
    if (row.status !== "missing_receipt") return;
    setReceiptUploadBusyId(row.id);
    try {
      const res = (await api.requestReceiptUpload(row.student_id)) as {
        whatsapp?: { wa_me_url?: string };
      };
      const url = res.whatsapp?.wa_me_url;
      if (url) openWhatsAppLink(url);
    } catch (e) {
      alertApiError(e);
    } finally {
      setReceiptUploadBusyId(null);
    }
  }

  return (
    <BackendShell title="付款紀錄">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-ink sm:text-2xl">付款紀錄</h2>
          <p className="mt-1 text-sm text-ink/65">
            全館學員交易、續會、收據與分期紀錄。預設顯示學員／項目／金額／方式／日期；可按「顯示欄位」打開狀態、教練、收據。按「詳情」睇齊全部資料。支援 CSV／Excel（.xlsx／.xls 只讀第一個 sheet）／ZIP 匯出匯入。
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-ink/15 bg-surface px-3 py-2.5 text-sm sm:w-auto"
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
            className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-surface px-3 py-2.5 text-base sm:text-sm"
          />
          <button
            type="button"
            onClick={() => void reload()}
            className="w-full rounded-lg bg-primary/90 px-4 py-2.5 text-sm font-semibold text-black sm:w-auto"
          >
            搜尋
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onExportCsv()}
            className="rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-primary/40"
          >
            匯出 CSV
          </button>
          <button
            type="button"
            onClick={() => void onExportFungCsv()}
            className="rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-primary/40"
          >
            匯出 Fung CSV（收錢格式）
          </button>
          <button
            type="button"
            onClick={() => void onExportZip()}
            className="rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-primary/40"
          >
            匯出 ZIP（CSV + 收據）
          </button>
          <label className="cursor-pointer rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm font-medium text-ink hover:border-primary/40">
            匯入 CSV／Excel／ZIP
            <input
              ref={importRef}
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm,.zip,text/csv,application/zip,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => void onImportFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {ioStatus ? <p className="text-sm text-ink/60">{ioStatus}</p> : null}

        {loading ? <p className="text-sm text-ink/55">載入中…</p> : null}
        {deletingId ? <p className="text-sm text-ink/55">刪除中…</p> : null}
        <PaymentRecordsTable
          rows={rows}
          showStudent
          emptyText="沒有符合條件的付款紀錄。"
          onDelete={handleDelete}
          onRequestReceiptUpload={handleRequestReceiptUpload}
          onReceiptUploaded={reload}
          receiptUploadBusyId={receiptUploadBusyId}
        />
      </div>
    </BackendShell>
  );
}
