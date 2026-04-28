"use client";

/*
 * QR console — onboarding / check-in / payload PDFs via FastAPI ``qrcode-pdf``;
 * attendance CSV template via ``downloadCsv`` (authenticated blob download).
 */

import BackendShell from "../../../../components/backend-shell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, downloadCsv } from "../../../../lib/api";

export default function AdminQrConsolePage() {
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const onboardUrl = origin ? `${origin}/student/onboard` : "";
  const checkinUrl = origin ? `${origin}/student/checkin?from=qr` : "";
  const payload = JSON.stringify({ type: "zomate_checkin", v: 1 });
  const onboardQrSrc = onboardUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(onboardUrl)}`
    : "";
  const checkinQrSrc = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(checkinUrl)}`
    : "";
  const payloadQrSrc = origin
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`
    : "";

  async function downloadQrPdf(kind: "onboard" | "checkin" | "payload") {
    try {
      setStatus("PDF 生成中…");
      const blob = await api.qrcodePdfBlob(kind, origin, kind === "payload" ? payload : undefined);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download =
        kind === "onboard" ? "onboarding_qrcode.pdf" : kind === "checkin" ? "checkin_qrcode.pdf" : "payload_qrcode.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setStatus("PDF 已生成並下載。");
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function downloadAttendanceTemplateCsv() {
    try {
      setStatus("下載範本中…");
      await downloadCsv("/api/admin/attendance/template.csv", "attendance-template.csv");
      setStatus(
        "已從後端下載 attendance-template.csv（PostgreSQL／後端路由於 FastAPI）。若失敗請確認 NEXT_PUBLIC_API_BASE_URL 與登入。"
      );
    } catch (e) {
      setStatus(String(e));
    }
  }

  return (
    <BackendShell title="QR 簽到中心">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">出勤 / 簽到管理</h2>
        <p className="text-sm text-slate-400">Demo 導覽頁：可集中管理簽到 QR、JSON QR、出勤核銷流程。</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 rounded-lg border border-[#333] bg-[#171717] p-3">
            <p className="text-sm font-medium">Core 1 · Onboarding QR</p>
            {onboardQrSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={onboardQrSrc} width={180} height={180} alt="Onboarding QR" className="rounded border border-[#333]" />
            )}
            <button type="button" onClick={() => void downloadQrPdf("onboard")}>
              匯出 onboarding PDF
            </button>
          </div>
          <div className="space-y-2 rounded-lg border border-[#333] bg-[#171717] p-3">
            <p className="text-sm font-medium">Core 3 · Check-in URL QR</p>
            {checkinQrSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={checkinQrSrc} width={180} height={180} alt="Check-in URL QR" className="rounded border border-[#333]" />
            )}
            <button type="button" onClick={() => void downloadQrPdf("checkin")}>
              匯出 checkin PDF
            </button>
          </div>
          <div className="space-y-2 rounded-lg border border-[#333] bg-[#171717] p-3">
            <p className="text-sm font-medium">Payload QR（離線牌）</p>
            {payloadQrSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={payloadQrSrc} width={180} height={180} alt="Payload QR" className="rounded border border-[#333]" />
            )}
            <button type="button" onClick={() => void downloadQrPdf("payload")}>
              匯出 payload PDF
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadAttendanceTemplateCsv()}>
            下載 attendance 範本（後端）
          </button>
          <label className="cursor-pointer rounded-md border border-[#333] px-3 py-2 text-sm text-slate-200">
            匯入 CSV（Demo 預覽）
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const count = Math.max(0, text.split("\n").length - 1);
                setStatus(`已讀取 ${count} 筆出勤資料（前端 Demo；批次匯入後端尚未開放）。`);
                ev.target.value = "";
              }}
            />
          </label>
        </div>
        {status && <p className="text-sm text-emerald-300">{status}</p>}
        <Link href="/admin" className="inline-block rounded-md border border-slate-500 px-4 py-2 text-sm text-slate-200">
          打開完整 QR 與出勤明細
        </Link>
      </div>
    </BackendShell>
  );
}
