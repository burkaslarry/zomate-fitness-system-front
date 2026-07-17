"use client";

/**
 * [F005][S003]
 * Feature: Balance Sync & Integrations
 * Step: WhatsApp template editor + sent log viewer
 * Logic: Admin edits student/coach payment reminder templates; previews placeholders; views sent logs.
 */

import { useCallback, useEffect, useState } from "react";
import BackendShell from "../../../../components/backend-shell";
import { alertApiError, api } from "../../../../lib/api";

type ApiWaLog = {
  id: number;
  recipient: string;
  message: string;
  created_at: string;
};

type WaTemplate = {
  key: string;
  audience: string;
  title: string;
  body: string;
  updated_at?: string | null;
};

const PLACEHOLDER_HINT =
  "{{course_title}} {{student_name}} {{student_phone}} {{pin}} {{next_lesson_date}} {{lessons_attended}} {{lessons_remaining}} {{payment_status}} {{amount_paid}} {{total_amount}} {{amount_owing}} {{installment_notes}}";

export default function AdminSettingsWhatsappPage() {
  const [apiLogs, setApiLogs] = useState<ApiWaLog[] | null>(null);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const loadApiLogs = useCallback(() => {
    void api
      .whatsappLogs()
      .then((raw) => {
        const arr = Array.isArray(raw) ? (raw as ApiWaLog[]) : [];
        setApiLogs(arr);
      })
      .catch(() => setApiLogs([]));
  }, []);

  const loadTemplates = useCallback(() => {
    void api
      .whatsappTemplates()
      .then((raw) => {
        const rows = Array.isArray(raw) ? (raw as WaTemplate[]) : [];
        setTemplates(rows);
        setDrafts(Object.fromEntries(rows.map((t) => [t.key, t.body])));
        setStatus("");
      })
      .catch((err) => {
        alertApiError(err);
        setStatus("無法載入 template（請確認已登入後台）。");
      });
  }, []);

  useEffect(() => {
    loadApiLogs();
    loadTemplates();
  }, [loadApiLogs, loadTemplates]);

  async function saveTemplate(key: string) {
    const body = drafts[key];
    if (!body?.trim()) {
      alertApiError(new Error("Template 內容不可為空"));
      return;
    }
    setSavingKey(key);
    try {
      await api.updateWhatsappTemplate(key, body.trim());
      setStatus(`已儲存：${key}`);
      loadTemplates();
      loadApiLogs();
    } catch (err) {
      alertApiError(err);
    } finally {
      setSavingKey(null);
    }
  }

  const tableRows =
    apiLogs?.map((log) => ({
      id: String(log.id),
      when: log.created_at,
      recipient: log.recipient,
      message: log.message,
      status: "✅ 已記錄"
    })) ?? [];

  const studentTemplates = templates.filter((t) => t.audience === "student");
  const coachTemplates = templates.filter((t) => t.audience === "coach");

  function renderTemplateSection(label: string, rows: WaTemplate[]) {
    if (rows.length === 0) return null;
    return (
      <section className="rounded-xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.04]">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/55">{label}</h3>
        <p className="mt-1 text-xs text-ink/50">可用變數：{PLACEHOLDER_HINT}</p>
        <div className="mt-4 grid gap-4">
          {rows.map((t) => (
            <div key={t.key} className="rounded-lg border border-ink/10 bg-canvas/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{t.title}</p>
                  <p className="text-xs text-ink/45 font-mono">{t.key}</p>
                </div>
                {t.updated_at ? (
                  <p className="text-[11px] text-ink/45">更新 {new Date(t.updated_at).toLocaleString()}</p>
                ) : null}
              </div>
              <textarea
                rows={10}
                value={drafts[t.key] ?? t.body}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [t.key]: e.target.value }))}
                className="mt-3 w-full resize-y rounded-lg border border-ink/10 bg-surface px-3 py-2 font-mono text-xs text-ink/85"
              />
              <button
                type="button"
                disabled={savingKey === t.key}
                onClick={() => void saveTemplate(t.key)}
                className="mt-3 rounded-lg bg-primary/90 px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
              >
                {savingKey === t.key ? "儲存中…" : "儲存 template"}
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <BackendShell title="Whatsapp 設定">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Whatsapp 設定</h2>
          <p className="mt-1 text-sm text-ink/60">
            編輯付款／收據確認訊息 template（學生、教練）。上傳收據或建立付款紀錄後，系統會依 template 寫入{" "}
            <code className="rounded bg-canvas px-1 py-0.5 text-xs ring-1 ring-ink/10">zomate_fs_whatsapp_logs</code>
            ，職員可複製到 WhatsApp 發送。
          </p>
          {status ? <p className="mt-2 text-sm text-emerald-800">{status}</p> : null}
        </div>

        {renderTemplateSection("Template · 學生", studentTemplates)}
        {renderTemplateSection("Template · 教練", coachTemplates)}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-lg font-semibold text-ink">已發送訊息</h3>
            <button
              type="button"
              onClick={() => {
                loadApiLogs();
                loadTemplates();
              }}
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
                      <td className="max-w-md whitespace-pre-wrap px-4 py-3 align-top text-ink/85">{row.message}</td>
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
