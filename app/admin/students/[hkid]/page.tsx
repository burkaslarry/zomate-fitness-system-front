"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BackendShell from "../../../../components/backend-shell";
import { alertApiError, api } from "../../../../lib/api";
import type { MemberFull } from "../../../../types/api";

const tabs = ["資料", "課程記錄", "Package", "收據", "活動紀錄"] as const;

type CatRow = { id: number; name: string; is_deleted?: boolean };

export default function AdminStudentDetailPage() {
  const params = useParams<{ hkid: string }>();
  const [data, setData] = useState<MemberFull | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("資料");
  const [toast, setToast] = useState("");
  const [categories, setCategories] = useState<CatRow[]>([]);
  const [catId, setCatId] = useState<number | "">("");
  const [lessons, setLessons] = useState(10);
  const [installments, setInstallments] = useState(3);
  const [saving, setSaving] = useState(false);
  const hkid = decodeURIComponent(params.hkid);

  const reload = useCallback(() => {
    void api.memberFull(hkid).then((row) => setData(row as MemberFull)).catch(alertApiError);
  }, [hkid]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    void api
      .courseCategories(false)
      .then((rows) => setCategories(rows as CatRow[]))
      .catch(alertApiError);
  }, []);

  async function onSaveCategoryEnrollment() {
    if (!data?.profile.id || catId === "") {
      alertApiError(new Error("請選擇課程種類"));
      return;
    }
    setSaving(true);
    try {
      await api.upsertStudentCategoryEnrollment(data.profile.id, {
        course_category_id: Number(catId),
        total_lessons: lessons,
        total_installments: installments
      });
      setToast("已更新課程／堂數");
      reload();
    } catch (e) {
      alertApiError(e);
    } finally {
      setSaving(false);
    }
  }

  async function onGrantTrial() {
    if (!data?.profile.id) return;
    if (!window.confirm("確認使用此學生唯一一次「教練試堂」額度？（+1 堂）")) return;
    try {
      await api.grantCoachTrial(data.profile.id, {});
      setToast("已發放試堂 1 堂");
      reload();
    } catch (e) {
      alertApiError(e);
    }
  }

  const pins = data?.course_checkin_pins ?? [];
  const catEnr = data?.category_enrollments ?? [];
  const trialLeft = data?.profile.coach_trial_quota_remaining ?? 0;

  return (
    <BackendShell title="學生詳情">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-xl border border-ink/15 bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-ink">{data?.profile.full_name ?? hkid}</h2>
              <p className="mt-1 text-sm text-ink/65">
                {data?.profile.hkid ?? "—"} · {data?.profile.phone}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data?.profile.is_active && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-800">活躍</span>
              )}
              <button
                type="button"
                disabled={trialLeft < 1}
                onClick={() => void onGrantTrial()}
                className="rounded-lg border border-ink/15 bg-primary/80 px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
              >
                教練試堂額度（剩 {trialLeft}）
              </button>
            </div>
          </div>
          {toast && <p className="mt-3 rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink/85">{toast}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-lg px-4 py-2 text-sm ${
                tab === item ? "bg-primary/90 text-ink" : "border border-ink/15 bg-surface text-ink/85"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <section className="rounded-xl border border-ink/15 bg-surface p-5 text-ink">
          {tab === "資料" && data && (
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="aspect-square overflow-hidden rounded-xl border border-ink/10 bg-canvas">
                {data.profile.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.profile.photo_url} alt={data.profile.full_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-ink/45">No photo</div>
                )}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink/50">Email</dt>
                  <dd>{data.profile.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">帳戶 PIN</dt>
                  <dd className="font-mono text-sm">
                    {data.profile.pin_code
                      ? data.profile.pin_code
                      : pins.length > 0
                        ? "—（請用下方課堂 PIN 簽到）"
                        : "—（報讀課程後會獲派課堂 PIN）"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Emergency</dt>
                  <dd>
                    {data.profile.emergency_contact_name ?? "—"} · {data.profile.emergency_contact_phone ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Remaining</dt>
                  <dd>{data.profile.lesson_balance} 堂</dd>
                </div>
              </dl>
            </div>
          )}
          {tab === "課程記錄" && data && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">課堂簽到 PIN（每個已報課程一個）</h3>
                {pins.length === 0 ? (
                  <p className="text-sm text-ink/55">尚未加入任何開課／課程，暫無 PIN。</p>
                ) : (
                  <ul className="space-y-2">
                    {pins.map((p) => (
                      <li
                        key={`${p.course_id}-${p.checkin_pin}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm"
                      >
                        <span>
                          {p.course_title} · {p.branch_name}
                        </span>
                        <span className="font-mono font-semibold tracking-wide">{p.checkin_pin}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-primary/35 bg-primary/5 p-4">
                <h3 className="mb-3 text-sm font-semibold text-ink">從課程種類入帳堂數（Admin）</h3>
                <p className="mb-3 text-xs text-ink/60">
                  選擇種類及總堂數；如該種類已存在會調整堂數差額。會建立分期計劃（預設 3 期）。{" "}
                </p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-xs text-ink/55">
                    課程種類
                    <select
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2 py-2 text-sm text-ink"
                      value={catId === "" ? "" : String(catId)}
                      onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-ink/55">
                    總堂數
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2 py-2 text-sm"
                      value={lessons}
                      onChange={(e) => setLessons(Number(e.target.value) || 1)}
                    />
                  </label>
                  <label className="block text-xs text-ink/55">
                    分期數（1–5）
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2 py-2 text-sm"
                      value={installments}
                      onChange={(e) => setInstallments(Math.min(5, Math.max(1, Number(e.target.value) || 3)))}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void onSaveCategoryEnrollment()}
                      className="w-full rounded-lg bg-primary/90 py-2 text-sm font-medium text-ink disabled:opacity-50"
                    >
                      {saving ? "…" : "儲存"}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">種類報讀紀錄（帳面）</h3>
                {catEnr.length === 0 ? (
                  <p className="text-sm text-ink/55">暫無</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {catEnr.map((c) => (
                      <li key={c.id} className="rounded border border-ink/10 bg-canvas px-3 py-2">
                        {c.category_name} · {c.total_lessons} 堂 · {c.status}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {tab === "Package" && <Rows rows={data?.packages ?? []} />}
          {tab === "收據" && (
            <div className="grid gap-3 md:grid-cols-3">
              {(data?.receipts ?? []).map((r) => (
                <a
                  key={r.id}
                  href={r.file_url ?? "#"}
                  target="_blank"
                  className="rounded-lg border border-ink/10 bg-canvas p-3 text-sm"
                  rel="noreferrer"
                >
                  <span className="block font-medium">
                    {r.source} · {r.payment_method ?? "未填"}
                  </span>
                  <span className="mt-1 block text-ink/55">
                    ${r.amount ?? 0} · {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </a>
              ))}
            </div>
          )}
          {tab === "活動紀錄" && <Rows rows={data?.activity_log ?? []} />}
        </section>
      </div>
    </BackendShell>
  );
}

function Rows({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className="text-sm text-ink/55">暫無記錄</p>;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <pre
          key={index}
          className="overflow-x-auto rounded-lg border border-ink/10 bg-canvas p-3 text-xs text-ink/85"
        >
          {JSON.stringify(row, null, 2)}
        </pre>
      ))}
    </div>
  );
}
