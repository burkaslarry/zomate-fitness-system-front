"use client";

import { FormEvent, useEffect, useState } from "react";
import BackendShell from "../../components/backend-shell";
import { getAuthSession, type AuthSession } from "../../lib/auth";
import { api, csvUrl, uploadCsv } from "../../lib/api";

/*
 * CF01: Authentication-aware Admin page core.
 * Steps:
 * 01. 取得登入 session（含角色）
 * 02. 依角色控管可見動作（ADMIN 可 hard delete）
 * 03. 封裝 refresh() 批次抓取頁面必要資料，縮短 API 循環
 */
type Student = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  health_notes: string | null;
  disclaimer_accepted: boolean;
  pin_code: string;
  lesson_balance: number;
  face_id_external: string | null;
  created_at: string;
};
type Branch = { id: number; name: string; address: string; code: string };
type Coach = { id: number; full_name: string; phone: string; branch_id: number | null };
type Enr = { student_id: number; student_name: string; student_phone: string; checkin_pin: string };
type CourseRow = {
  id: number;
  title: string;
  branch_name: string;
  scheduled_start: string;
  scheduled_end: string;
  enrollments: Enr[];
};

export default function AdminPage() {
  /*
   * CF02: Data state declaration.
   * Steps:
   * 01. 維護學生、分店、教練、課堂、日誌 5 組列表
   * 02. 維護畫面提示與 origin、來源頁參數
   * 03. 透過 session 決定權限邏輯
   */
  const [session, setSession] = useState<AuthSession | null>(null);
  const [origin, setOrigin] = useState("");
  const [health, setHealth] = useState("…");
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [logs, setLogs] = useState<Array<{ id: number; message: string; recipient: string }>>([]);
  const [auditLogs, setAuditLogs] = useState<
    Array<{
      id: number;
      created_at: string;
      action: string;
      student_name: string;
      course_title: string | null;
      coach_name: string | null;
      coach_phone: string | null;
      detail: { pin_resolution?: string; lesson_balance_after?: number } | null;
    }>
  >([]);
  const [selectedStudents, setSelectedStudents] = useState<Record<number, boolean>>({});

  const onboardUrl = origin ? `${origin}/student/onboard` : "";
  const qrSrc = onboardUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(onboardUrl)}`
    : "";
  const checkinUrl = origin ? `${origin}/student/checkin?from=qr` : "";
  const checkinQrSrc = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(checkinUrl)}`
    : "";
  const checkinPayloadSample = JSON.stringify({ type: "zomate_checkin", v: 1 });
  const checkinPayloadQrSrc = origin
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(checkinPayloadSample)}`
    : "";
  const canHardDelete = session?.role === "ADMIN";

  /*
   * CF03: Action orchestration.
   * Steps:
   * 01. refresh() 以 Promise.all 拉取核心資料
   * 02. doAction() 包裝 try/catch 並觸發頁面狀態更新
   * 03. 提供通用的 PDF 匯出與刪除方法（soft/hard）
   */

  async function refresh() {
    const [s, m, b, c, cr, l, au] = await Promise.all([
      api.listStudents() as Promise<Student[]>,
      api.summary() as Promise<Record<string, number>>,
      api.branches() as Promise<Branch[]>,
      api.coaches() as Promise<Coach[]>,
      api.adminCourses() as Promise<CourseRow[]>,
      api.whatsappLogs() as Promise<Array<{ id: number; message: string; recipient: string }>>,
      api.auditLogs(100) as Promise<
        Array<{
          id: number;
          created_at: string;
          action: string;
          student_name: string;
          course_title: string | null;
          coach_name: string | null;
          coach_phone: string | null;
          detail: { pin_resolution?: string; lesson_balance_after?: number } | null;
        }>
      >
    ]);
    setStudents(s);
    setSummary(m);
    setBranches(b);
    setCoaches(c);
    setCourses(cr);
    setLogs(l);
    setAuditLogs(au);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    setSession(getAuthSession());
  }, []);

  useEffect(() => {
    api
      .health()
      .then(() => setHealth("已連接 API"))
      .catch((e) => setHealth(String(e)));
    refresh().catch((e) => setStatus(String(e)));
  }, []);

  async function doAction(fn: () => Promise<void>, msg: string) {
    try {
      await fn();
      await refresh();
      setStatus(msg);
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function downloadQr(kind: "onboard" | "checkin" | "payload") {
    const blob = await api.qrcodePdfBlob(kind, origin, kind === "payload" ? checkinPayloadSample : undefined);
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download =
      kind === "onboard" ? "onboarding_qrcode.pdf" : kind === "checkin" ? "checkin_qrcode.pdf" : "payload_qrcode.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  async function doDeleteStudent(id: number, hard: boolean) {
    await doAction(() => api.deleteStudent(id, hard), hard ? "已 hard delete 學生" : "已 soft delete 學生");
  }

  async function doDeleteBranch(id: number, hard: boolean) {
    await doAction(() => api.deleteBranch(id, hard), hard ? "已 hard delete 分店" : "已 soft delete 分店");
  }

  async function doDeleteCoach(id: number, hard: boolean) {
    await doAction(() => api.deleteCoach(id, hard), hard ? "已 hard delete 教練" : "已 soft delete 教練");
  }

  async function doDeleteCourse(id: number, hard: boolean) {
    await doAction(() => api.deleteCourse(id, hard), hard ? "已 hard delete 課堂" : "已 soft delete 課堂");
  }

  async function addBranch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await doAction(
      () =>
        api.createBranch({
          name: String(f.get("name")),
          address: String(f.get("address")),
          code: String(f.get("code"))
        }),
      "分店已新增"
    );
    e.currentTarget.reset();
  }

  async function addCoach(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const bid = f.get("branch_id");
    await doAction(
      () =>
        api.createCoach({
          full_name: String(f.get("full_name")),
          phone: String(f.get("phone")),
          branch_id: bid ? Number(bid) : null
        }),
      "教練已新增"
    );
    e.currentTarget.reset();
  }

  async function createCourse(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ids = Object.entries(selectedStudents)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    const start = String(f.get("scheduled_start"));
    const end = String(f.get("scheduled_end"));
    await doAction(
      () =>
        api.createCourse({
          title: String(f.get("title")),
          branch_id: Number(f.get("branch_id")),
          coach_id: Number(f.get("coach_id")),
          scheduled_start: new Date(start).toISOString(),
          scheduled_end: new Date(end).toISOString(),
          student_ids: ids,
          credits_on_enroll: Number(f.get("credits_on_enroll") ?? 10)
        }),
      "課堂已建立；學員已加餘額並寫入示範 WhatsApp。"
    );
    setSelectedStudents({});
  }

  function toggleStudent(id: number) {
    setSelectedStudents((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function seedDefaultBranch(e: FormEvent) {
    e.preventDefault();
    if (branches.some((b) => b.code === "TST-AUSTIN")) {
      setStatus("預設分店已存在（code TST-AUSTIN）");
      return;
    }
    await doAction(
      () =>
        api.createBranch({
          name: "Zomate Fitness Studio",
          address: "Austin Road 102, 22/F Zomate Fitness Studio",
          code: "TST-AUSTIN"
        }),
      "已加入尖沙咀預設分店"
    );
  }

  return (
    <BackendShell title="後台 Admin">
      <main className="mx-auto max-w-6xl space-y-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">後台 Admin</h1>
          <p className="text-sm text-slate-500">登入身份：{session?.username}（{session?.role}）</p>
        </div>
      <p className="text-sm text-slate-600">API：{health}</p>
      {status && <p className="rounded-md bg-amber-50 p-2 text-sm">{status}</p>}

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold">Core 1 · 數碼入職 QR</h2>
          <p className="mb-3 text-xs text-slate-500">學生掃描後開啟登記頁；無需手打 PIN，系統自動派發。</p>
          {qrSrc && (
            <div className="flex flex-col items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} width={220} height={220} alt="Onboarding QR" className="rounded border" />
              <code className="break-all text-xs text-slate-600">{onboardUrl}</code>
              <button type="button" className="text-sm underline" onClick={() => downloadQr("onboard")}>
                匯出 onboarding PDF
              </button>
            </div>
          )}
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold">Core 3 · 簽到 QR</h2>
          <p className="mb-3 text-xs text-slate-500">
            連結已帶 <code className="text-xs">from=qr</code>，打開即跳過「驗證 QR」步驟，直接搜尋姓名 + PIN 扣堂。亦可列印右邊 JSON QR 俾相機掃描驗證。
          </p>
          {checkinQrSrc && (
            <div className="flex flex-col items-start gap-3">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">網址 QR</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={checkinQrSrc} width={200} height={200} alt="Check-in URL QR" className="rounded border" />
                <code className="mt-1 block break-all text-xs text-slate-600">{checkinUrl}</code>
                <button type="button" className="text-sm underline" onClick={() => downloadQr("checkin")}>
                  匯出 checkin PDF
                </button>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">JSON QR（離線牌）</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={checkinPayloadQrSrc}
                  width={160}
                  height={160}
                  alt="Check-in payload QR"
                  className="rounded border"
                />
                <code className="mt-1 block break-all text-[10px] text-slate-500">{checkinPayloadSample}</code>
                <button type="button" className="text-sm underline" onClick={() => downloadQr("payload")}>
                  匯出 payload PDF
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold">概覽</h2>
          <pre className="text-xs">{JSON.stringify(summary, null, 2)}</pre>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 font-semibold">學生紀錄 · CSV</h2>
        <div className="mb-4 flex flex-wrap gap-3">
          <a className="inline-block rounded border border-slate-300 px-3 py-2 text-sm" href={csvUrl.studentsExport()}>
            匯出 students.csv
          </a>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
            匯入 CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (ev) => {
                const file = ev.target.files?.[0];
                if (!file) return;
                const r = await uploadCsv("/api/admin/students/import", file);
                setStatus(`學生匯入：${r.imported ?? 0} 筆，略過 ${r.skipped ?? 0}`);
                await refresh();
                ev.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {students.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2">
              <div>
                <span className="font-medium">{s.full_name}</span> · {s.phone} · 餘額 {s.lesson_balance} · PIN{" "}
                <span className="font-mono">{s.pin_code}</span>
                {s.health_notes && (
                  <span className="ml-2 text-xs text-slate-500">（健康申報已填）</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() =>
                    doAction(
                      () => api.bindFace(s.id, `HKV-${String(s.id).padStart(4, "0")}`),
                      `已綁定 FaceID：${s.full_name}`
                    )
                  }
                >
                  綁 FaceID
                </button>
                <button type="button" className="text-xs underline" onClick={() => doDeleteStudent(s.id, false)}>
                  刪除
                </button>
                {canHardDelete && (
                  <button type="button" className="text-xs underline" onClick={() => doDeleteStudent(s.id, true)}>
                    hard delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold">分店 · CSV</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <a className="text-sm underline" href={csvUrl.branchesExport()}>
              匯出
            </a>
            <label className="text-sm underline">
              匯入
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (ev) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  const r = await uploadCsv("/api/admin/branches/import", file);
                  setStatus(`分店匯入 ${r.imported ?? 0} 筆`);
                  await refresh();
                  ev.target.value = "";
                }}
              />
            </label>
            <button type="button" className="text-sm underline" onClick={seedDefaultBranch}>
              一鍵尖沙咀預設
            </button>
          </div>
          <form onSubmit={addBranch} className="space-y-2 text-sm">
            <input name="name" placeholder="名稱" required />
            <input name="address" placeholder="地址" required />
            <input name="code" placeholder="代碼（唯一）" required />
            <button type="submit">新增分店</button>
          </form>
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {branches.map((b) => (
              <li key={b.id} className="flex justify-between gap-2">
                <span>
                  {b.code} — {b.name}
                </span>
                <span className="flex gap-2">
                  <button type="button" className="text-xs underline" onClick={() => doDeleteBranch(b.id, false)}>
                    刪除
                  </button>
                  {canHardDelete && (
                    <button type="button" className="text-xs underline" onClick={() => doDeleteBranch(b.id, true)}>
                      hard delete
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-2 font-semibold">教練 · CSV</h2>
          <div className="mb-3 flex gap-2">
            <a className="text-sm underline" href={csvUrl.coachesExport()}>
              匯出
            </a>
            <label className="text-sm underline">
              匯入
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (ev) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  const r = await uploadCsv("/api/admin/coaches/import", file);
                  setStatus(`教練匯入 ${r.imported ?? 0} 筆`);
                  await refresh();
                  ev.target.value = "";
                }}
              />
            </label>
          </div>
          <form onSubmit={addCoach} className="space-y-2 text-sm">
            <input name="full_name" placeholder="姓名" required />
            <input name="phone" placeholder="電話" required />
            <select name="branch_id" className="w-full">
              <option value="">— 分店（可空）—</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} {b.name}
                </option>
              ))}
            </select>
            <button type="submit">新增教練</button>
          </form>
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {coaches.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>
                  {c.full_name} · {c.phone}
                </span>
                <span className="flex gap-2">
                  <button type="button" className="text-xs underline" onClick={() => doDeleteCoach(c.id, false)}>
                    刪除
                  </button>
                  {canHardDelete && (
                    <button type="button" className="text-xs underline" onClick={() => doDeleteCoach(c.id, true)}>
                      hard delete
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold">Core 2 · 開班派學員（隨機 5 位課堂 PIN + 加 10 堂）</h2>
        <form onSubmit={createCourse} className="grid gap-3 md:grid-cols-2">
          <input name="title" placeholder="課堂名稱" required className="md:col-span-2" />
          <select name="branch_id" required>
            <option value="">— 分店 —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select name="coach_id" required>
            <option value="">— 教練 —</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <input type="datetime-local" name="scheduled_start" required />
          <input type="datetime-local" name="scheduled_end" required />
          <label className="text-sm md:col-span-2">
            派發加堂數（預設 10）
            <input name="credits_on_enroll" type="number" min={0} max={200} defaultValue={10} className="mt-1" />
          </label>
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium">選擇學員</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2 text-sm">
              {students.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!selectedStudents[s.id]}
                    onChange={() => toggleStudent(s.id)}
                    className="w-auto"
                  />
                  {s.full_name} · {s.phone}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="md:col-span-2">
            建立課堂並通知
          </button>
        </form>
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold">最近課堂</h3>
          {courses.slice(0, 8).map((c) => (
            <div key={c.id} className="rounded border p-2 text-xs">
              <div className="font-medium">{c.title}</div>
              <div className="text-slate-600">
                {c.branch_name} · {new Date(c.scheduled_start).toLocaleString()}
              </div>
              <div className="mt-1 flex gap-2">
                <button type="button" className="text-xs underline" onClick={() => doDeleteCourse(c.id, false)}>
                  刪除
                </button>
                {canHardDelete && (
                  <button type="button" className="text-xs underline" onClick={() => doDeleteCourse(c.id, true)}>
                    hard delete
                  </button>
                )}
              </div>
              <ul className="mt-1">
                {c.enrollments.map((e) => (
                  <li key={e.student_id}>
                    {e.student_name} · PIN <span className="font-mono">{e.checkin_pin}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold">Audit log · 扣堂紀錄</h2>
        <p className="mb-3 text-xs text-slate-500">
          每次成功扣堂寫入：課堂 PIN → 只對應該堂主教練發通知；帳戶 PIN／FaceID → 按今日課表揀一堂（時段內優先）再通知該教練；無課堂則{" "}
          <code className="text-xs">coach-demo</code>。
        </p>
        <div className="max-h-72 overflow-x-auto text-xs">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-2">時間</th>
                <th className="py-2 pr-2">學員</th>
                <th className="py-2 pr-2">課堂</th>
                <th className="py-2 pr-2">教練（通知對象）</th>
                <th className="py-2 pr-2">PIN 類型</th>
                <th className="py-2">餘額</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-2">{row.student_name}</td>
                  <td className="py-2 pr-2">{row.course_title ?? "—"}</td>
                  <td className="py-2 pr-2">
                    {row.coach_name ? (
                      <>
                        {row.coach_name}
                        <span className="block text-slate-500">{row.coach_phone}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">coach-demo</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">{row.detail?.pin_resolution ?? "—"}</td>
                  <td className="py-2">{row.detail?.lesson_balance_after ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {auditLogs.length === 0 && <p className="py-4 text-slate-500">暫無紀錄</p>}
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold">WhatsApp 示範 log</h2>
        <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {logs.map((log) => (
            <div key={log.id} className="rounded border p-2">
              <div className="text-xs text-slate-500">{log.recipient}</div>
              <div>{log.message}</div>
            </div>
          ))}
        </div>
      </section>
      </main>
    </BackendShell>
  );
}
