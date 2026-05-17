"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Open course package — loading overlay, success list (name / phone / 課堂 PIN), coach WhatsApp reminder
 * Logic: POST ``/api/admin/courses`` with optional first-session fields; modal shows enrollments from response.
 */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import type { BranchDto, CoachDto, MemberProfile, TrialClassKindDto } from "../../../types/api";

type CourseEnrollmentSummary = {
  student_id: number;
  student_name: string;
  student_phone: string;
  checkin_pin: string;
};

/** Python `enumerate_lesson_dates`: 0 = Monday … 6 = Sunday */
const WEEK_LOOKUP: { day: number; label: string; zh: string }[] = [
  { day: 0, label: "Mon", zh: "一" },
  { day: 1, label: "Tue", zh: "二" },
  { day: 2, label: "Wed", zh: "三" },
  { day: 3, label: "Thu", zh: "四" },
  { day: 4, label: "Fri", zh: "五" },
  { day: 5, label: "Sat", zh: "六" },
  { day: 6, label: "Sun", zh: "日" }
];

function combineLocalDateTime(dateStr: string, timeStr: string): string {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return `${dateStr}T${t}`;
}

export default function AdminCourseSetPage() {
  const [kinds, setKinds] = useState<TrialClassKindDto[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [coaches, setCoaches] = useState<CoachDto[]>([]);
  const [students, setStudents] = useState<MemberProfile[]>([]);
  const [studentFilter, setStudentFilter] = useState("");
  const [kindId, setKindId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [coachId, setCoachId] = useState<number | "">("");
  const [courseDate, setCourseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [totalLessons, setTotalLessons] = useState(10);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  /** Optional: verbally agreed first session with student (notified to coach). */
  const [agreedFirstDate, setAgreedFirstDate] = useState("");
  const [agreedFirstTime, setAgreedFirstTime] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [successCoachName, setSuccessCoachName] = useState("");
  const [successHadStudents, setSuccessHadStudents] = useState(false);
  const [successEnrollments, setSuccessEnrollments] = useState<CourseEnrollmentSummary[]>([]);
  const [submitBusy, setSubmitBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [k, b, c, s] = await Promise.all([
          api.trialClassKinds(),
          api.publicBranches(),
          api.publicCoaches(),
          api.listStudents()
        ]);
        if (cancelled) return;
        setKinds(Array.isArray(k) ? (k as TrialClassKindDto[]) : []);
        setBranches(Array.isArray(b) ? (b as BranchDto[]) : []);
        setCoaches(Array.isArray(c) ? (c as CoachDto[]) : []);
        setStudents(Array.isArray(s) ? (s as MemberProfile[]) : []);
      } catch (e) {
        if (!cancelled) alertApiError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const branchDetail = useMemo(() => branches.find((x) => x.id === branchId), [branches, branchId]);

  function toggleWeekday(d: number) {
    setWeekdays((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      if (prev.length >= 3) return prev;
      return [...prev, d].sort((a, b) => a - b);
    });
  }

  const filteredStudents = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => `${s.full_name} ${s.phone}`.toLowerCase().includes(q));
  }, [studentFilter, students]);

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setStatus("");
    const titleKind = kinds.find((x) => x.id === kindId);
    if (!titleKind || !branchId || !coachId) {
      setStatus("請選擇課程種類、分店與教練。");
      return;
    }
    if (weekdays.length < 1) {
      setStatus("請選擇至少一個上課日（最多三個）。");
      return;
    }
    const student_ids = Object.entries(picked)
      .filter(([, v]) => v)
      .map(([id]) => Number(id));
    const scheduled_start = combineLocalDateTime(courseDate, startTime);
    const scheduled_end = combineLocalDateTime(courseDate, endTime);
    if (scheduled_end <= scheduled_start) {
      setStatus("結束時間須晚於開始時間。");
      return;
    }
    const agreedIso =
      agreedFirstDate && agreedFirstTime
        ? new Date(combineLocalDateTime(agreedFirstDate, agreedFirstTime)).toISOString()
        : undefined;
    const noteTrim = coachNote.trim();
    setSubmitBusy(true);
    try {
      const created = (await api.createCourse({
        title: titleKind.label_zh,
        branch_id: branchId,
        coach_id: coachId,
        scheduled_start,
        scheduled_end,
        student_ids,
        course_start_date: courseDate,
        lesson_weekdays: weekdays,
        total_lessons: totalLessons,
        ...(agreedIso ? { student_first_session_at: agreedIso } : {}),
        ...(noteTrim ? { coach_schedule_note: noteTrim } : {})
      })) as { enrollments?: CourseEnrollmentSummary[] };
      setStatus("");
      const cname = coaches.find((c) => c.id === coachId)?.full_name ?? "教練";
      setSuccessCoachName(cname);
      setSuccessHadStudents(student_ids.length > 0);
      const enr = Array.isArray(created?.enrollments) ? created.enrollments : [];
      setSuccessEnrollments(enr);
      setSuccessOpen(true);
      setPicked({});
    } catch (e) {
      alertApiError(e);
    } finally {
      setSubmitBusy(false);
    }
  }

  return (
    <BackendShell title="Course 套餐開課">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-ink">開課（套餐）</h2>
          <p className="mt-2 text-sm text-ink/65">
            堂數 1–120；每星期揀一至日（最多 3 個上課日）；用行事曆揀首日。建立後伺服器會計算預計最後一堂日期（系列結束）。編入學員時，餘額會按{" "}
            <strong className="font-medium text-ink">套餐堂數</strong> 加入。
          </p>
          <p className="mt-1 text-xs text-ink/50">
            課程種類請先到{" "}
            <Link href="/admin/branches" className="underline underline-offset-4">
              分店管理 → Course 種類
            </Link>{" "}
            設定。
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-ink/55">載入中…</p>
        ) : kinds.length === 0 ? (
          <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
            目前沒有啟用的課程種類。請至{" "}
            <Link href="/admin/branches" className="font-medium underline">
              分店管理
            </Link>{" "}
            啟用至少一種。
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-ink/10 bg-surface p-6 shadow-sm ring-1 ring-ink/[0.04]">
            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">課程名稱</span>
              <select
                required
                value={kindId === "" ? "" : String(kindId)}
                onChange={(e) => setKindId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="">請選擇（來自 Course 種類）</option>
                {kinds.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label_zh}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">分店（必填）</span>
              <select
                required
                value={branchId === "" ? "" : String(branchId)}
                onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="">請選擇</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.address}
                  </option>
                ))}
              </select>
              {branchDetail ? (
                <span className="text-xs text-ink/55">
                  {[
                    branchDetail.address,
                    branchDetail.business_start_time && branchDetail.business_end_time
                      ? `${branchDetail.business_start_time}–${branchDetail.business_end_time}`
                      : null,
                    branchDetail.remarks
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">教練（指派）</span>
              <select
                required
                value={coachId === "" ? "" : String(coachId)}
                onChange={(e) => setCoachId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
              >
                <option value="">請選擇</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} (#{c.id})
                  </option>
                ))}
              </select>
              <span className="text-xs text-amber-900/90">
                同名可能有多筆教練（不同 id）。請揀<strong className="font-medium">與續會／約定一致</strong>嗰位，否則教練頁唔會對應。
              </span>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">首日（開學／套餐起始日）</span>
              <input
                type="date"
                required
                value={courseDate}
                onChange={(e) => setCourseDate(e.target.value)}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-ink/70">開始時間</span>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-ink/70">結束時間</span>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-ink/70">每星期上課日（最多 3 個）</span>
              <div className="flex flex-wrap gap-2">
                {WEEK_LOOKUP.map(({ day, label, zh }) => {
                  const on = weekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        on
                          ? "border-primary bg-primary/15 text-ink shadow-[inset_0_0_0_1px_rgba(45,36,34,0.08)]"
                          : "border-ink/15 bg-canvas text-ink/55 hover:border-ink/25"
                      }`}
                    >
                      {label} {zh}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink/50">已選：{weekdays.length}/3</p>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">套餐堂數（1–120）</span>
              <input
                type="number"
                required
                min={1}
                max={120}
                value={totalLessons}
                onChange={(e) =>
                  setTotalLessons(Math.min(120, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink sm:max-w-[12rem]"
              />
            </label>

            <div className="rounded-lg border border-sky-200/60 bg-sky-50/80 p-4 space-y-3">
              <p className="text-xs font-semibold text-ink">與學員約定首課（選填）</p>
              <p className="text-xs text-ink/60">
                上面「首日／時間」係<strong>系統排程基準</strong>。若櫃台已同學員約定另一個首堂時間，可填下方；會一併寫入教練通知（WhatsApp 日誌），提醒教練再確認。
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="text-ink/70">約定日期</span>
                  <input
                    type="date"
                    value={agreedFirstDate}
                    onChange={(e) => setAgreedFirstDate(e.target.value)}
                    className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-ink/70">約定時間</span>
                  <input
                    type="time"
                    value={agreedFirstTime}
                    onChange={(e) => setAgreedFirstTime(e.target.value)}
                    className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="text-ink/70">給教練備註（選填）</span>
                <textarea
                  value={coachNote}
                  onChange={(e) => setCoachNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="例如：學員希望週四晚、已留 WhatsApp…"
                  className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <span className="text-sm text-ink/70">編入學員（可多選）</span>
                <input
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  placeholder="篩選姓名／電話…"
                  className="max-w-xs flex-1 rounded-lg border border-ink/10 bg-canvas px-3 py-1.5 text-xs text-ink"
                />
              </div>
              <div className="max-h-56 overflow-auto rounded-lg border border-ink/10 bg-canvas">
                <table className="w-full border-collapse text-left text-sm">
                  <colgroup>
                    <col style={{ width: 24 }} />
                    <col />
                    <col />
                  </colgroup>
                  <thead className="sticky top-0 border-b border-ink/10 bg-surface text-xs text-ink/60">
                    <tr>
                      <th className="p-1.5" aria-label="選取" />
                      <th className="px-2 py-2 font-medium">姓名</th>
                      <th className="px-2 py-2 font-medium">電話</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.id} className="border-b border-ink/[0.06]">
                        <td className="p-1 align-middle">
                          <input
                            type="checkbox"
                            checked={Boolean(picked[s.id])}
                            onChange={(e) =>
                              setPicked((prev) => ({
                                ...prev,
                                [s.id]: e.target.checked
                              }))
                            }
                            className="ml-0.5 h-4 w-4 accent-primary"
                          />
                        </td>
                        <td className="px-2 py-2 text-ink">{s.full_name}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-ink/80">{s.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {status ? <p className="text-sm text-rose-800">{status}</p> : null}

            <button
              type="submit"
              disabled={submitBusy}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 sm:w-auto"
            >
              {submitBusy ? "建立中…" : "建立課程"}
            </button>
          </form>
        )}
        {submitBusy ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
            role="alertdialog"
            aria-busy="true"
            aria-live="polite"
            aria-labelledby="course-create-loading-title"
          >
            <div className="w-full max-w-sm rounded-xl border border-ink/10 bg-surface p-6 shadow-lg">
              <p id="course-create-loading-title" className="text-center text-lg font-semibold text-ink">
                建立課程中…
              </p>
              <p className="mt-2 text-center text-sm text-ink/60">請稍候，正在編入學員及派發課堂 PIN。</p>
            </div>
          </div>
        ) : null}
        {successOpen ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-success-title"
          >
            <div className="w-full max-w-md rounded-xl border border-ink/10 bg-surface p-6 shadow-lg">
              <h3 id="course-success-title" className="text-lg font-semibold text-ink">
                課程已建立
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/80">
                {successHadStudents ? (
                  <>
                    已將學員編入課程；系統已向 <strong className="text-ink">{successCoachName}</strong> 發送 WhatsApp
                    日誌通知（後台可查）。
                  </>
                ) : (
                  <>課程系列已建立；本次未剔選學員，故<strong className="text-ink">未</strong>向教練發送入班通知。</>
                )}
              </p>
              {successHadStudents ? (
                <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                  <strong>請提醒教練</strong>：主動約學員確認<strong>第一堂實際時間、地點</strong>
                  （系統首課時段僅作排程基準；若已填「與學員約定首課」，通知內會一併寫明）。
                </p>
              ) : null}
              {!successHadStudents ? (
                <p className="mt-2 text-xs text-ink/55">需要教練喺課表見到學員時，請剔選學員後再建立；或之後編輯課程補入學員。</p>
              ) : null}
              {successEnrollments.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-medium text-ink/55">已編入學員 · 課堂 PIN（請交俾學員簽到）</p>
                  <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-ink/10 bg-canvas p-3 text-sm">
                    {successEnrollments.map((e) => (
                      <li key={`${e.student_id}-${e.checkin_pin}`} className="border-b border-ink/[0.06] pb-2 last:border-0 last:pb-0">
                        <div className="font-medium text-ink">{e.student_name}</div>
                        <div className="text-xs text-ink/65">電話 {e.student_phone}</div>
                        <div className="mt-1 font-mono text-sm font-semibold text-ink">課堂 PIN：{e.checkin_pin}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : successHadStudents ? (
                <p className="mt-3 text-xs text-amber-900/90">
                  已送開課請求；若列表無顯示學員 PIN，請稍後喺「學生詳情 → 課程記錄」查看。
                </p>
              ) : null}
              <button
                type="button"
                className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-ink hover:bg-primary/90"
                onClick={() => {
                  setSuccessOpen(false);
                  setSuccessEnrollments([]);
                }}
              >
                知道了
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </BackendShell>
  );
}
