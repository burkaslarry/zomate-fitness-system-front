"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: POST ``/api/admin/courses`` (`total_lessons` 10–30, optional `total_installments` PIN tranches); success modal + WhatsApp deeplink.
 * Logic: Optional first-session fields + weekly series; response enrollments include `installment_segments` when installments > 1.
 */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BackendShell from "../../../components/backend-shell";
import { alertApiError, api } from "../../../lib/api";
import type {
  BranchDto,
  CoachDto,
  InstallmentSegmentPinDto,
  MemberProfile,
  CourseCategoryDto
} from "../../../types/api";

type CourseEnrollmentSummary = {
  student_id: number;
  student_name: string;
  student_phone: string;
  checkin_pin: string;
  installment_segments?: InstallmentSegmentPinDto[];
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

function buildEnrollmentWhatsAppText(courseTitle: string, rows: CourseEnrollmentSummary[]): string {
  const lines = rows.map((e) => {
    if (e.installment_segments && e.installment_segments.length > 0) {
      const segs = e.installment_segments
        .map((s) => {
          const unpaid = s.paid === false;
          const suffix = unpaid ? "（待標記已付後先可用於簽到）" : "（可簽到）";
          const reminder = s.reminder_lesson ? `；第${s.reminder_lesson}堂提醒付款` : "";
          return `第${s.installment_no}個分期（第${s.lesson_from}–${s.lesson_to}堂${reminder}）PIN：${s.pin}${suffix}`;
        })
        .join("\n");
      return `${e.student_name}（${e.student_phone}）\n${segs}`;
    }
    return `${e.student_name}（${e.student_phone}）\n課堂 PIN：${e.checkin_pin}`;
  });
  return `【Zomate 開課】${courseTitle}\n請交俾學員簽到用：\n\n${lines.join("\n\n")}`;
}

function whatsappMeUrl(phone: string, body: string): string {
  const digits = phone.replace(/\D/g, "");
  const n = digits.length === 8 ? `852${digits}` : digits;
  return `https://wa.me/${n}?text=${encodeURIComponent(body)}`;
}

export default function AdminCourseSetPage() {
  const [kinds, setKinds] = useState<CourseCategoryDto[]>([]);
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
  const [totalInstallments, setTotalInstallments] = useState(1);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  /** Optional: verbally agreed first session with student (notified to coach). */
  const [agreedFirstDate, setAgreedFirstDate] = useState("");
  const [agreedFirstTime, setAgreedFirstTime] = useState("");
  const [coachNote, setCoachNote] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [successCoachName, setSuccessCoachName] = useState("");
  const [successCourseTitle, setSuccessCourseTitle] = useState("");
  const [successHadStudents, setSuccessHadStudents] = useState(false);
  const [successEnrollments, setSuccessEnrollments] = useState<CourseEnrollmentSummary[]>([]);
  /** Course id returned by POST — used to PATCH installment-paid from success modal */
  const [successCourseId, setSuccessCourseId] = useState<number | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [reminderBusy, setReminderBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [k, b, c, s] = await Promise.all([
          api.publicCourseCategories(),
          api.publicBranches(),
          api.publicCoaches(),
          api.listStudents()
        ]);
        if (cancelled) return;
        setKinds(Array.isArray(k) ? (k as CourseCategoryDto[]) : []);
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

  async function markSegmentPaid(studentId: number, installmentNo: number) {
    if (successCourseId == null) return;
    try {
      await api.markCourseInstallmentPaid(successCourseId, {
        student_id: studentId,
        installment_no: installmentNo
      });
      setSuccessEnrollments((prev) =>
        prev.map((row) => {
          if (row.student_id !== studentId || !row.installment_segments?.length) {
            return row;
          }
          return {
            ...row,
            installment_segments: row.installment_segments.map((s) =>
              s.installment_no === installmentNo ? { ...s, paid: true } : s
            )
          };
        })
      );
    } catch (e) {
      alertApiError(e);
    }
  }

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
    if (totalInstallments > totalLessons) {
      setStatus("分期數唔可以大於套餐堂數；請調整分期或堂數。");
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
        title: titleKind.name,
        branch_id: branchId,
        coach_id: coachId,
        scheduled_start,
        scheduled_end,
        student_ids,
        course_start_date: courseDate,
        lesson_weekdays: weekdays,
        total_lessons: totalLessons,
        total_installments: totalInstallments,
        ...(agreedIso ? { student_first_session_at: agreedIso } : {}),
        ...(noteTrim ? { coach_schedule_note: noteTrim } : {})
      })) as { id?: number; enrollments?: CourseEnrollmentSummary[] };
      setStatus("");
      const cname = coaches.find((c) => c.id === coachId)?.full_name ?? "教練";
      setSuccessCourseTitle(titleKind.name);
      setSuccessCoachName(cname);
      setSuccessHadStudents(student_ids.length > 0);
      setSuccessCourseId(typeof created?.id === "number" ? created.id : null);
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

  async function sendSegmentReminder(studentId: number, installmentNo: number) {
    if (successCourseId == null) return;
    const key = `${studentId}-${installmentNo}`;
    setReminderBusy(key);
    try {
      await api.sendPaymentReminder(studentId, {
        course_enrollment_id: successCourseId,
        installment_no: installmentNo,
        receipt_confirmed: false,
        notify_coach: true
      });
      setStatus("已記錄 WhatsApp 催款 reminder，未有標記已付。");
    } catch (e) {
      alertApiError(e);
    } finally {
      setReminderBusy(null);
    }
  }

  async function updateSegmentReminder(studentId: number, installmentNo: number, reminderLesson: number) {
    if (successCourseId == null || !Number.isFinite(reminderLesson)) return;
    try {
      await api.updateCourseInstallmentReminder(successCourseId, {
        student_id: studentId,
        installment_no: installmentNo,
        reminder_lesson: reminderLesson
      });
      setSuccessEnrollments((prev) =>
        prev.map((row) => {
          if (row.student_id !== studentId || !row.installment_segments?.length) return row;
          return {
            ...row,
            installment_segments: row.installment_segments.map((s) =>
              s.installment_no === installmentNo ? { ...s, reminder_lesson: reminderLesson } : s
            )
          };
        })
      );
      setStatus(`已更新第 ${reminderLesson} 堂 reminder。`);
    } catch (e) {
      alertApiError(e);
    }
  }

  return (
    <BackendShell title="Course 套餐開課">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-ink">開課（套餐）</h2>
          <p className="mt-2 text-sm text-ink/65">
            付款／收據先於 Unified Payment 完成；本頁負責安排第一堂時間、課程種類、教練與學生，並產生跟 course 的簽到 PIN。
            套餐堂數<strong className="text-ink"> 10–30</strong>
            ，一次付款對應一個 course PIN；若<strong className="font-medium text-ink">分批／分期過數</strong>
            ，可揀「分期數」，系統會按堂數自動拆區間並派<strong className="font-medium text-ink">每個分期一個 PIN</strong>
            （例：30 堂 3 期 → 第 1 期 PIN 對應第 1–10 堂）。
            每星期揀一至日（最多 3 個）；由<strong className="text-ink">首日</strong>
            起按每個上課日<strong className="text-ink">遞推到滿套餐堂數</strong>預約（例：只得星期一會 gen 星期一連續排到夠數）。編入學員後餘額會按套餐堂數入帳。
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
                    {k.name}
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
                          ? "border-primary bg-primary/15 text-black shadow-[inset_0_0_0_1px_rgba(45,36,34,0.08)]"
                          : "border-ink/15 bg-canvas text-ink/55 hover:border-ink/25"
                      }`}
                    >
                      {label} {zh}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink/50">
                已選：{weekdays.length}/3。揀某日（例如星期一）即由「首日」起<strong className="text-ink/70">每逢該星期</strong>
                排到滿「套餐堂數」（系統用堂數＋上課日決定最後一堂）。
              </p>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">套餐堂數</span>
              <input
                id="total-lessons-field"
                type="number"
                required
                min={10}
                max={30}
                placeholder="請填上堂數"
                value={totalLessons}
                onChange={(e) =>
                  setTotalLessons(Math.min(30, Math.max(10, Number(e.target.value) || 10)))
                }
                aria-describedby="total-lessons-hint"
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink/35 sm:max-w-[12rem]"
              />
              <p id="total-lessons-hint" className="text-xs text-ink/55">
                最少 <span className="tabular-nums font-medium text-ink/70">10</span> 堂，最多{" "}
                <span className="tabular-nums font-medium text-ink/70">30</span> 堂
              </p>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">分期數（一次過數一個 PIN）</span>
              <select
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(Number(e.target.value))}
                className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2 text-sm text-ink sm:max-w-[16rem]"
              >
                <option value={1}>唔分期（全套 1 個 PIN）</option>
                <option value={2}>2 期（2 個 PIN，堂數會拆成兩段）</option>
                <option value={3}>3 期（3 個 PIN）</option>
              </select>
              <span className="text-xs text-ink/50">
                揀 2 或以上即「分期」：每期一個 PIN；最多 3 期。<strong className="text-ink">首期預設已可簽到</strong>，第 2 期起要
                <strong className="text-ink">標記已付／已找數</strong>先有得用嗰個 PIN 簽到（成功 popup 內可即時按「標記已付」）。
                30 堂 3 期預設於第 9／19／29 堂出 reminder。
              </span>
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
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-black shadow-sm hover:opacity-95 disabled:opacity-50 sm:w-auto"
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
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-ink/55">
                    {successEnrollments.some((e) => (e.installment_segments?.length ?? 0) > 0)
                      ? "已編入學員 · 分期 PIN（對應堂數區間）"
                      : "已編入學員 · 課堂 PIN（請交俾學員簽到）"}
                  </p>
                  <ul className="max-h-60 space-y-3 overflow-y-auto rounded-lg border border-ink/10 bg-canvas p-3 text-sm">
                    {successEnrollments.map((e) => (
                      <li key={e.student_id} className="border-b border-ink/[0.06] pb-3 last:border-0 last:pb-0">
                        <div className="font-medium text-ink">{e.student_name}</div>
                        <div className="text-xs text-ink/70">電話 {e.student_phone}</div>
                        {(e.installment_segments?.length ?? 0) > 0 ? (
                          <ul className="mt-2 space-y-1.5 rounded-md bg-surface px-2 py-2 font-mono text-xs text-ink sm:text-sm">
                            {e.installment_segments!.map((s) => {
                              const unpaid = s.paid === false;
                              return (
                                <li key={`${e.student_id}-seg-${s.installment_no}`} className="border-b border-ink/[0.06] pb-1.5 last:border-0 last:pb-0">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                    <span>
                                      <span className="text-ink/70">
                                        第{s.installment_no}個分期：第{s.lesson_from}–{s.lesson_to} 堂 PIN：
                                      </span>{" "}
                                      <span className="font-semibold">{s.pin}</span>
                                      {s.reminder_lesson ? (
                                        <span className="ml-1 text-sky-800">（第{s.reminder_lesson}堂 reminder）</span>
                                      ) : null}
                                      {unpaid ? (
                                        <span className="ml-1 text-amber-900/90">（待付／未開通簽到）</span>
                                      ) : (
                                        <span className="ml-1 text-emerald-800">（可簽到）</span>
                                      )}
                                    </span>
                                    {unpaid ? (
                                      <div className="flex shrink-0 flex-wrap gap-1.5">
                                        <label className="flex items-center gap-1 rounded-md border border-ink/10 bg-canvas px-2 py-1 text-[11px] font-semibold text-ink/75">
                                          提醒堂數
                                          <input
                                            type="number"
                                            min={s.lesson_from}
                                            max={s.lesson_to}
                                            defaultValue={s.reminder_lesson ?? Math.max(s.lesson_from, s.lesson_to - 1)}
                                            onBlur={(ev) => {
                                              const next = Number(ev.currentTarget.value);
                                              const cur = s.reminder_lesson ?? Math.max(s.lesson_from, s.lesson_to - 1);
                                              if (next !== cur) {
                                                void updateSegmentReminder(e.student_id, s.installment_no, next);
                                              }
                                            }}
                                            className="w-14 rounded border border-ink/10 bg-surface px-1 py-0.5 text-center"
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          disabled={successCourseId == null || reminderBusy === `${e.student_id}-${s.installment_no}`}
                                          onClick={() => void sendSegmentReminder(e.student_id, s.installment_no)}
                                          className="rounded-md border border-sky-600/35 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {reminderBusy === `${e.student_id}-${s.installment_no}` ? "發送中…" : "WhatsApp 催款"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={successCourseId == null}
                                          onClick={() => void markSegmentPaid(e.student_id, s.installment_no)}
                                          className="rounded-md border border-ink/15 bg-surface px-2 py-1 text-[11px] font-semibold text-ink hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          標記此期已付 → 開通簽到
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <div className="mt-2 font-mono font-semibold text-ink">課堂 PIN：{e.checkin_pin}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : successHadStudents ? (
                <p className="mt-3 text-xs text-amber-900/90">
                  已送開課請求；若列表無顯示學員 PIN，請稍後喺「學生詳情 → 課程記錄」查看。
                </p>
              ) : null}
              <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
                <button
                  type="button"
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-black hover:bg-primary/90 sm:w-auto sm:min-w-[8rem]"
                  onClick={() => {
                    setSuccessOpen(false);
                    setSuccessEnrollments([]);
                    setSuccessCourseTitle("");
                    setSuccessCourseId(null);
                  }}
                >
                  知道了
                </button>
                <button
                  type="button"
                  disabled={successEnrollments.length === 0}
                  className="w-full rounded-lg border border-ink/15 bg-canvas px-4 py-2.5 text-sm font-semibold text-ink hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:min-w-[10rem]"
                  onClick={() => {
                    const title = successCourseTitle || "開課";
                    const msg = buildEnrollmentWhatsAppText(title, successEnrollments);
                    const phone = successEnrollments[0].student_phone;
                    window.open(whatsappMeUrl(phone, msg), "_blank", "noopener,noreferrer");
                  }}
                >
                  Send WhatsApp 通知
                </button>
              </div>
              {successEnrollments.length > 1 ? (
                <p className="mt-2 text-center text-xs text-ink/50 sm:text-left">
                  多位學員時按鈕會用<strong className="text-ink/70">首位</strong>電話開 WhatsApp；可複製訊息再發俾其他學員。
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </BackendShell>
  );
}
