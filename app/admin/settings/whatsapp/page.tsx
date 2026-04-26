"use client";

import BackendShell from "../../../../components/backend-shell";
import { useDemoState } from "../../../../lib/demo-state";

export default function AdminSettingsWhatsappPage() {
  const { whatsappLogs } = useDemoState();

  return (
    <BackendShell title="WhatsApp API 狀態">
      <div className="mx-auto max-w-6xl space-y-4">
        <h2 className="text-2xl font-semibold">WhatsApp 設定</h2>
        <p className="text-sm text-slate-400">
          Demo 版頁面：可查看 API 連線狀態與訊息 template（例如 Congrats! 你已有 10 堂課餘額）。
        </p>
        <div className="overflow-x-auto rounded-xl border border-[#333] bg-[#171717]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="text-[#a0a0a0]">
                <th className="px-4 py-3">時間</th>
                <th className="px-4 py-3">接收者</th>
                <th className="px-4 py-3">訊息</th>
                <th className="px-4 py-3">狀態</th>
              </tr>
            </thead>
            <tbody>
              {whatsappLogs.map((log) => (
                <tr key={log.id} className="border-t border-[#262626]">
                  <td className="px-4 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2">{log.recipient}</td>
                  <td className="px-4 py-2">{log.message}</td>
                  <td className="px-4 py-2">{log.status === "Delivered" ? "✅✅ Delivered" : log.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BackendShell>
  );
}
