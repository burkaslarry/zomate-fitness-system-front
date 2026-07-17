"use client";

/**
 * [F002][S004]
 * Feature: Course Entry & Automation
 * Step: Admin QR console — onboard and check-in PDF previews
 * Logic: Onboarding / check-in URL PDFs via FastAPI ``qrcode-pdf`` (Zomate Fitness Limited branded).
 */

import BackendShell from "../../../../components/backend-shell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, downloadCsv } from "../../../../lib/api";

const btnPrimary =
  "inline-flex items-center justify-center rounded-lg border border-ink/10 bg-primary px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-primary/90";
const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-ink/15 bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-canvas";

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
  const onboardQrSrc = onboardUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(onboardUrl)}`
    : "";
  const checkinQrSrc = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(checkinUrl)}`
    : "";

  async function downloadQrPdf(kind: "onboard" | "checkin") {
    try {
      setStatus("PDF 生成中…");
      const blob = await api.qrcodePdfBlob(kind, origin);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = kind === "onboard" ? "zomate_onboarding_qrcode.pdf" : "checkin_qrcode.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      setStatus("PDF 已生成並下載（含 Zomate Fitness Limited 標題）。");
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
        <p className="text-sm text-ink/55">
          下載 PDF 含 <strong className="text-ink">Zomate Fitness Limited</strong> 標題及 QR 碼，可列印放於接待處。
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-sm font-semibold text-ink">新會員加入</p>
            <p className="text-xs text-ink/55">學生掃描 QR 或按下方按鈕，直接進入入會登記頁。</p>
            {onboardQrSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={onboardQrSrc}
                width={180}
                height={180}
                alt="新會員加入 QR"
                className="rounded border border-ink/10 bg-white p-2"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/student/onboard" target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                開啟新會員加入
              </Link>
              <button type="button" className={btnSecondary} onClick={() => void downloadQrPdf("onboard")}>
                匯出新會員加入 PDF
              </button>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.04]">
            <p className="text-sm font-semibold text-ink">簽到</p>
            <p className="text-xs text-ink/55">學生掃描 QR 或按下方按鈕，直接進入簽到扣堂頁。</p>
            {checkinQrSrc && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={checkinQrSrc}
                width={180}
                height={180}
                alt="簽到 QR"
                className="rounded border border-ink/10 bg-white p-2"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/student/checkin?from=qr" target="_blank" rel="noopener noreferrer" className={btnPrimary}>
                開啟簽到
              </Link>
              <button type="button" className={btnSecondary} onClick={() => void downloadQrPdf("checkin")}>
                匯出簽到 PDF
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={() => void downloadAttendanceTemplateCsv()}>
            下載 attendance 範本（後端）
          </button>
          <label className={`cursor-pointer ${btnSecondary}`}>
            匯入 CSV（預覽）
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                const count = Math.max(0, text.split("\n").length - 1);
                setStatus(`已讀取 ${count} 筆出勤資料（批次匯入後端尚未開放）。`);
                ev.target.value = "";
              }}
            />
          </label>
        </div>
        {status && <p className="text-sm text-emerald-800">{status}</p>}
      </div>
    </BackendShell>
  );
}
