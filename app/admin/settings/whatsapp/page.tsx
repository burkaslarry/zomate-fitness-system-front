"use client";

import BackendShell from "../../../../components/backend-shell";

export default function AdminSettingsWhatsappPage() {
  return (
    <BackendShell title="WhatsApp API 狀態">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">WhatsApp 設定</h2>
        <p className="text-sm text-slate-400">
          Demo 版頁面：可查看 API 連線狀態與訊息 template（例如 Congrats! 你已有 10 堂課餘額）。
        </p>
      </div>
    </BackendShell>
  );
}
