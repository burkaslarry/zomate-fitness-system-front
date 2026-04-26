"use client";

import BackendShell from "../../../../components/backend-shell";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";

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

  function exportTemplateCsv() {
    const lines = ["student_name,phone,pin,checkin_time", "Larry Lo,+85291234567,12345,2026-04-26T10:00:00Z"];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance-template.csv";
    a.click();
    URL.revokeObjectURL(url);
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
          <button type="button" onClick={exportTemplateCsv}>
            匯出 attendance.csv
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
                setStatus(`已讀取 ${count} 筆出勤資料（Demo 預覽）`);
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
