"use client";

/**
 * [F005][S003]
 * Feature: Balance Sync & Integrations
 * Step: (see Logic)
 * Logic: WhatsApp settings and log viewer for admins.
 */

import { useCallback, useEffect, useState } from "react";
import BackendShell from "../../../../components/backend-shell";
import { api } from "../../../../lib/api";
import { useDemoState } from "../../../../lib/demo-state";

type ApiWaLog = {
  id: number;
  recipient: string;
  message: string;
  created_at: string;
};

const TEMPLATE_DRAFTS = [
  {
    key: "onboarding",
    title: "新人 onboarding 確認",
    body: "Welcome {{name}}, your onboarding is confirmed."
  },
  {
    key: "checkin",
    title: "簽到成功",
    body: "Check-in success. Remaining credits: {{credits}}."
  },
  {
    key: "class_reminder",
    title: "開課前提醒",
    body: "Your class starts in 30 mins."
  }
];

export default function AdminSettingsWhatsappPage() {
  const { whatsappLogs: demoLogs } = useDemoState();
  const [apiLogs, setApiLogs] = useState<ApiWaLog[] | null>(null);

  const loadApiLogs = useCallback(() => {
    void api
      .whatsappLogs()
      .then((raw) => {
        const arr = Array.isArray(raw) ? (raw as ApiWaLog[]) : [];
        setApiLogs(arr);
      })
      .catch(() => setApiLogs([]));
  }, []);

  useEffect(() => {
    loadApiLogs();
  }, [loadApiLogs]);

  const tableRows =
    apiLogs && apiLogs.length > 0
      ? apiLogs.map((log) => ({
          id: String(log.id),
          when: log.created_at,
          recipient: log.recipient,
          message: log.message,
          status: "✅✅ Delivered"
        }))
      : demoLogs.map((log) => ({
          id: String(log.id),
          when: log.timestamp,
          recipient: log.recipient,
          message: log.message,
          status: log.status === "Delivered" ? "✅✅ Delivered" : log.status
        }));

  return (
    <BackendShell title="Whatsapp 設定">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Whatsapp 設定</h2>
          <p className="mt-1 text-sm text-ink/60">
            示範版面：上方為連線與 template 草稿；下方為已發送訊息（優先顯示後端{" "}
            <code className="rounded bg-canvas px-1 py-0.5 text-xs ring-1 ring-ink/10">GET /api/admin/whatsapp-logs</code>
            ，無資料時用本機 demo）。
          </p>
        </div>

        <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04]">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/55">WhatsApp config（示範）</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-ink/10 bg-canvas/80 px-3 py-2">
              <dt className="text-xs font-medium text-ink/50">Webhook verify token</dt>
              <dd className="mt-1 font-mono text-xs text-ink">••••••••（未接駁）</dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-canvas/80 px-3 py-2">
              <dt className="text-xs font-medium text-ink/50">API version</dt>
              <dd className="mt-1 font-mono text-xs text-ink">Graph API v21.x（預留）</dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-canvas/80 px-3 py-2">
              <dt className="text-xs font-medium text-ink/50">Business phone ID</dt>
              <dd className="mt-1 font-mono text-xs text-ink">—</dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-canvas/80 px-3 py-2">
              <dt className="text-xs font-medium text-ink/50">Sender status</dt>
              <dd className="mt-1 text-ink/85">Demo · 未連線 production</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04]">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/55">Template message drafts（示範）</h3>
          <p className="mt-1 text-xs text-ink/50">之後可對接 WhatsApp Cloud API template 名稱與變數對應。</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {TEMPLATE_DRAFTS.map((t) => (
              <label key={t.key} className="block space-y-1">
                <span className="text-xs font-medium text-ink/65">{t.title}</span>
                <textarea
                  readOnly
                  rows={4}
                  value={t.body}
                  className="w-full resize-none rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-xs text-ink/85 ring-1 ring-ink/[0.03]"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-lg font-semibold text-ink">已發送訊息</h3>
            <button
              type="button"
              onClick={() => loadApiLogs()}
              className="rounded-lg border border-ink/15 bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface"
            >
              重新載入
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 bg-canvas">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/55">時間</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/55">接收者</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/55">訊息</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink/55">狀態</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-ink/55">
                      尚無訊息紀錄。
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => (
                    <tr key={row.id} className="border-b border-ink/[0.08] last:border-0 hover:bg-canvas/80">
                      <td className="whitespace-nowrap px-4 py-3 align-top text-ink/80">
                        {new Date(row.when).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-ink/80">{row.recipient}</td>
                      <td className="max-w-md px-4 py-3 align-top text-ink/85">{row.message}</td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-ink/80">{row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </BackendShell>
  );
}
