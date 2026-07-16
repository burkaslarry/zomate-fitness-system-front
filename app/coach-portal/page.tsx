"use client";

/**
 * [F003][S001]
 * Feature: Coach Dashboard
 * Step: Auth gate, pending queue, hourly calendar (9–19), payments, signature update
 * Logic: COACH-only; scheduling via enrollment.coach_time_confirmed; strict slot blocking.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import CoachHourlyDayView from "../../components/coach-hourly-day-view";
import { alertApiError, api } from "../../lib/api";
import { getAuthSession } from "../../lib/auth";
import type { CoachStudentBriefDto, CoachStudentRecordDto, CoachRemindPaymentDto } from "../../types/api";

type CoachMe = { id: number; full_name: string; phone: string; branch_name: string | null };
type PendingRow = {
  enrollment_id: number;
  course_id: number;
  student_id: number;
  student_name: string;
  student_phone: string;
  course_title: string;
  branch_name: string;
  total_lessons: number;
  placeholder_start: string;
};
type PaymentRow = {
  student_id: number;
  student_name: string;
  student_phone: string;
  course_id: number;
  course_title: string;
  payment_status: string;
  installment_status: string;
  next_installment_no?: number | null;
  next_reminder_lesson?: number | null;
  signature_image_url: string | null;
};
type CourseRow = {
  id: number;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  enrollments: { student_id: number; student_name: string }[];
};

type Tab = "schedule" | "students" | "payments";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** [F003][S003] Build wa.me link with polite payment reminder. */
function remindPayWaLink(phone: string, name: string, courseTitle: string): string {
  const digits = phone.replace(/\D/g, "");
  const hk = digits.startsWith("852") ? digits : `852${digits.replace(/^0+/, "")}`;
  const text = encodeURIComponent(
    `【Zomate Fitness】${name} 你好，溫馨提醒：你的課程「${courseTitle}」尚有款項待付，請盡快安排付款。如有疑問請聯絡我們，謝謝！`
  );
  return `https://wa.me/${hk}?text=${text}`;
}

function occupiedHoursForDay(courses: CourseRow[], day: string, excludeCourseIds: Set<number>): Set<number> {
  const occupied = new Set<number>();
  for (const c of courses) {
    if (excludeCourseIds.has(c.id)) continue;
    if (localDateKey(c.scheduled_start) !== day) continue;
    const startH = new Date(c.scheduled_start).getHours();
    let endH = new Date(c.scheduled_end).getHours();
    if (endH <= startH) endH = startH + 1;
    for (let h = startH; h < endH; h++) occupied.add(h);
  }
  return occupied;
}

function formatCourseSlotLine(c: CourseRow): string {
  const time = new Date(c.scheduled_start).toLocaleTimeString("zh-HK", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const names = c.enrollments.map((e) => e.student_name).join("、");
  return `${time} — ${c.title}, name: ${names}`;
}

function pendingFromEnrollment(
  studentId: number,
  studentName: string,
  studentPhone: string,
  enr: {
    enrollment_id: number;
    course_title: string;
    scheduled_start: string;
    total_lessons: number;
  }
): PendingRow {
  return {
    enrollment_id: enr.enrollment_id,
    course_id: enr.enrollment_id,
    student_id: studentId,
    student_name: studentName,
    student_phone: studentPhone,
    course_title: enr.course_title,
    branch_name: "",
    total_lessons: enr.total_lessons,
    placeholder_start: enr.scheduled_start
  };
}

function slotWouldConflict(
  occupied: Set<number>,
  startHour: number,
  durationHours: number
): boolean {
  for (let h = startHour; h < startHour + durationHours; h++) {
    if (occupied.has(h)) return true;
  }
  return startHour + durationHours > 19;
}

export default function CoachDashboardPage() {
  const [authOk, setAuthOk] = useState(false);
  const [roleDenied, setRoleDenied] = useState(false);
  const [coach, setCoach] = useState<CoachMe | null>(null);
  const [tab, setTab] = useState<Tab>("schedule");
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [dayCourses, setDayCourses] = useState<CourseRow[]>([]);
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [selectedPending, setSelectedPending] = useState<PendingRow | null>(null);
  const [startHour, setStartHour] = useState<number>(9);
  const [durationHours, setDurationHours] = useState<1 | 2>(1);
  const [scheduling, setScheduling] = useState(false);
  const [status, setStatus] = useState("");
  const [students, setStudents] = useState<CoachStudentBriefDto[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentRecords, setStudentRecords] = useState<CoachStudentRecordDto | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [bookingEnrollmentId, setBookingEnrollmentId] = useState<number | null>(null);
  const [bookDay, setBookDay] = useState(todayKey);
  const [bookStartHour, setBookStartHour] = useState(9);
  const [bookDuration, setBookDuration] = useState<1 | 2>(1);
  const [bookBusy, setBookBusy] = useState(false);
  const [remindBusy, setRemindBusy] = useState<number | null>(null);
  const [scheduleStudentId, setScheduleStudentId] = useState<number | null>(null);
  const [pickBusy, setPickBusy] = useState(false);

  const pendingCourseIds = useMemo(() => new Set(pending.map((p) => p.course_id)), [pending]);
  const excludeCourseIds = useMemo(() => {
    const ids = new Set(pendingCourseIds);
    if (selectedPending) ids.add(selectedPending.enrollment_id);
    return ids;
  }, [pendingCourseIds, selectedPending]);
  const occupied = useMemo(
    () => occupiedHoursForDay(dayCourses, selectedDay, excludeCourseIds),
    [dayCourses, selectedDay, excludeCourseIds]
  );

  const unpaidPayments = useMemo(() => {
    return payments.filter((p) => p.payment_status === "Pending" || p.payment_status === "Overdue");
  }, [payments]);

  const paymentUrgent = unpaidPayments;

  const paidPayments = useMemo(() => payments.filter((p) => p.payment_status === "Paid"), [payments]);

  const bookOccupiedForStudent = useMemo(
    () =>
      occupiedHoursForDay(
        dayCourses,
        bookDay,
        bookingEnrollmentId ? new Set([...pendingCourseIds, bookingEnrollmentId]) : pendingCourseIds
      ),
    [dayCourses, bookDay, pendingCourseIds, bookingEnrollmentId]
  );


  const reloadAll = useCallback(async (coachId: number) => {
    const [pList, payList, cList, sList] = await Promise.all([
      api.coachPendingStudents(coachId) as Promise<PendingRow[]>,
      api.coachStudentPayments(coachId) as Promise<PaymentRow[]>,
      api.coachSchedule(coachId, selectedDay) as Promise<CourseRow[]>,
      api.coachStudents(coachId) as Promise<CoachStudentBriefDto[]>
    ]);
    setPending(pList ?? []);
    setPayments(payList ?? []);
    setDayCourses(cList ?? []);
    setStudents(sList ?? []);
  }, [selectedDay]);

  useEffect(() => {
    const session = getAuthSession();
    if (!session) return;
    if (session.role !== "COACH") {
      setRoleDenied(true);
      return;
    }
    void (async () => {
      try {
        const me = (await api.coachMe()) as CoachMe;
        setCoach(me);
        setAuthOk(true);
        await reloadAll(me.id);
      } catch (e) {
        alertApiError(e);
        setStatus(String(e));
      }
    })();
  }, [reloadAll]);

  useEffect(() => {
    if (!coach) return;
    void api
      .coachSchedule(coach.id, selectedDay)
      .then((c) => setDayCourses((c ?? []) as CourseRow[]))
      .catch((e) => setStatus(String(e)));
  }, [coach, selectedDay]);

  const pickStudentForSchedule = useCallback(
    async (studentId: number) => {
      if (!coach) return;
      setScheduleStudentId(studentId);
      setPickBusy(true);
      setStatus("");
      try {
        const rec = (await api.coachStudentRecords(studentId, coach.id)) as CoachStudentRecordDto;
        const target = rec.enrollments.find((e) => !e.coach_time_confirmed) ?? rec.enrollments[0];
        if (!target) {
          setScheduleStudentId(null);
          setStatus("此學員暫無可排程課程。");
          return;
        }
        setSelectedPending(
          pendingFromEnrollment(studentId, rec.full_name, rec.phone, {
            enrollment_id: target.enrollment_id,
            course_title: target.course_title,
            scheduled_start: target.scheduled_start,
            total_lessons: target.total_lessons
          })
        );
        if (target.coach_time_confirmed) {
          setSelectedDay(localDateKey(target.scheduled_start));
          setStartHour(new Date(target.scheduled_start).getHours());
        } else {
          setSelectedDay(todayKey());
          setStartHour(9);
          setDurationHours(1);
        }
      } catch (e) {
        setScheduleStudentId(null);
        alertApiError(e);
        setStatus(String(e));
      } finally {
        setPickBusy(false);
      }
    },
    [coach]
  );

  useEffect(() => {
    if (!selectedPending) {
      setScheduleStudentId(null);
      return;
    }
    setScheduleStudentId(selectedPending.student_id);
  }, [selectedPending]);

  /** [F003][S002] Auto-select when only one student — avoids dead-end empty calendar. */
  useEffect(() => {
    if (!coach || !authOk || pickBusy || selectedPending) return;
    if (pending.length === 1) {
      setSelectedPending(pending[0]);
      setScheduleStudentId(pending[0].student_id);
      return;
    }
    if (pending.length === 0 && students.length === 1) {
      void pickStudentForSchedule(students[0].student_id);
    }
  }, [coach, authOk, pending, students, selectedPending, pickBusy, pickStudentForSchedule]);

  async function confirmSchedule() {
    if (!coach || !selectedPending) return;
    if (slotWouldConflict(occupied, startHour, durationHours)) {
      setStatus("此時段已被佔用或超出 19:00，請另選。");
      return;
    }
    setScheduling(true);
    setStatus("");
    try {
      await api.coachBookSession({
        enrollment_id: selectedPending.enrollment_id,
        day: selectedDay,
        start_hour: startHour,
        duration_hours: durationHours,
        coach_id: coach.id
      });
      setSelectedPending(null);
      setScheduleStudentId(null);
      await reloadAll(coach.id);
      setStatus("已排程。");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/conflict|409|佔用/i.test(msg)) {
        setStatus("此時段已被佔用，請另選時間。");
      } else {
        alertApiError(e);
        setStatus(msg);
      }
    } finally {
      setScheduling(false);
    }
  }

  async function loadStudentRecords(studentId: number) {
    if (!coach) return;
    setSelectedStudentId(studentId);
    setRecordsLoading(true);
    setStudentRecords(null);
    setBookingEnrollmentId(null);
    try {
      const rec = (await api.coachStudentRecords(studentId, coach.id)) as CoachStudentRecordDto;
      setStudentRecords(rec);
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setRecordsLoading(false);
    }
  }

  async function bookEnrollment(enrollmentId: number, confirmed: boolean) {
    if (!coach) return;
    const bookOccupied = occupiedHoursForDay(
      dayCourses,
      bookDay,
      new Set([...pendingCourseIds, enrollmentId])
    );
    if (slotWouldConflict(bookOccupied, bookStartHour, bookDuration)) {
      setStatus("此時段已被佔用或超出 19:00，請另選。");
      return;
    }
    setBookBusy(true);
    setStatus("");
    try {
      await api.coachBookSession({
        enrollment_id: enrollmentId,
        day: bookDay,
        start_hour: bookStartHour,
        duration_hours: bookDuration,
        coach_id: coach.id
      });
      await reloadAll(coach.id);
      if (selectedStudentId) await loadStudentRecords(selectedStudentId);
      setBookingEnrollmentId(null);
      setStatus(confirmed ? "已改期。" : "已排程。");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/conflict|409|佔用/i.test(msg)) {
        setStatus("此時段已被佔用，請另選時間。");
      } else {
        alertApiError(e);
        setStatus(msg);
      }
    } finally {
      setBookBusy(false);
    }
  }

  async function sendPaymentReminder(studentId: number, courseId: number) {
    if (!coach) return;
    setRemindBusy(courseId);
    setStatus("");
    try {
      const res = (await api.coachRemindPayment(studentId, {
        course_id: courseId,
        coach_id: coach.id
      })) as CoachRemindPaymentDto;
      window.open(res.wa_link, "_blank", "noopener,noreferrer");
      setStatus("已記錄 WhatsApp 催款訊息，並開啟 WhatsApp。");
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setRemindBusy(null);
    }
  }

  if (roleDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-ink">
        <div className="max-w-md rounded-xl border border-ink/10 bg-surface p-6 text-center shadow-sm">
          <p className="text-sm">此頁面僅供教練帳號使用。</p>
          <Link href="/login?logout=1" className="mt-4 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline">
            重新登入
          </Link>
        </div>
      </main>
    );
  }

  if (!authOk || !coach) {
    return null;
  }

  const schedulePanel = (
    <div className="space-y-4 pb-24">
      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">學員排程</h2>
        <p className="mt-1 text-xs text-ink/55">
          {pending.length > 0
            ? `你有 ${pending.length} 位學員待確認上課時間（未付款亦可排程）。`
            : "點選學員卡片 → 喺下方日曆點時段排程；未付款亦可安排上堂。"}
        </p>
        {pickBusy ? <p className="mt-2 text-xs text-primary">載入學員課程…</p> : null}
        {pending.length === 0 ? (
          students.length === 0 ? (
            <p className="mt-3 text-sm text-ink/50">目前沒有指派學員。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {students.map((s) => (
                <li key={s.student_id}>
                  <button
                    type="button"
                    onClick={() => void pickStudentForSchedule(s.student_id)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      scheduleStudentId === s.student_id || selectedPending?.student_id === s.student_id
                        ? "border-primary bg-primary/10 ring-2 ring-primary/35"
                        : "border-ink/10 bg-canvas hover:border-primary/40 active:scale-[0.99]"
                    }`}
                  >
                    <div className="font-medium text-ink">{s.full_name}</div>
                    <div className="mt-0.5 text-xs text-ink/60">
                      餘 {s.lesson_balance} 堂 · {s.enrollment_count} 課程
                      {s.pending_schedule ? " · 待排程" : " · 可改期"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((p) => (
              <li key={p.enrollment_id}>
                <button
                  type="button"
                  onClick={() => setSelectedPending(p)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                    selectedPending?.enrollment_id === p.enrollment_id
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-ink/10 bg-canvas hover:border-primary/40"
                  }`}
                >
                  <div className="font-medium text-ink">{p.student_name}</div>
                  <div className="mt-0.5 text-xs text-ink/60">
                    {p.course_title} · {p.branch_name} · {p.total_lessons} 堂
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">日曆 · 9:00–19:00</h2>
          <input
            type="date"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="rounded-lg border border-ink/15 bg-canvas px-2 py-1 text-sm text-ink"
          />
        </div>
        {selectedPending ? (
          <p className="mt-2 text-xs text-ink/65">
            正在為 <strong>{selectedPending.student_name}</strong> 排程 · {selectedPending.course_title} · 點選空白時段（1–2 小時）
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink/50">Google Calendar 日視圖 — 先揀學員，再點時段。</p>
        )}
        <CoachHourlyDayView
          hours={HOURS}
          dayCourses={dayCourses}
          excludeCourseIds={excludeCourseIds}
          occupied={occupied}
          selectedStudentName={selectedPending?.student_name ?? null}
          startHour={startHour}
          durationHours={durationHours}
          slotWouldConflict={slotWouldConflict}
          onPickSlot={(h, dur) => {
            setStartHour(h);
            setDurationHours(dur);
          }}
        />
        {selectedPending ? (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-ink/10 pt-4">
            <label className="text-xs text-ink/70">
              開始
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="mt-1 block rounded-lg border border-ink/15 bg-canvas px-2 py-1.5 text-sm"
              >
                {HOURS.filter((h) => !slotWouldConflict(occupied, h, durationHours)).map((h) => (
                  <option key={h} value={h}>
                    {pad2(h)}:00
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink/70">
              時長
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value) as 1 | 2)}
                className="mt-1 block rounded-lg border border-ink/15 bg-canvas px-2 py-1.5 text-sm"
              >
                {[1, 2].filter((d) => !slotWouldConflict(occupied, startHour, d)).map((d) => (
                  <option key={d} value={d}>
                    {d} 小時
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={scheduling || slotWouldConflict(occupied, startHour, durationHours)}
              onClick={() => void confirmSchedule()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {scheduling ? "提交中…" : "確認排程"}
            </button>
          </div>
        ) : null}
        {dayCourses.filter((c) => !pendingCourseIds.has(c.id)).length > 0 ? (
          <ul className="mt-4 space-y-1 border-t border-ink/10 pt-3 text-xs text-ink/65">
            {dayCourses
              .filter((c) => !pendingCourseIds.has(c.id))
              .map((c) => (
                <li key={c.id}>{formatCourseSlotLine(c)}</li>
              ))}
          </ul>
        ) : null}
      </section>
    </div>
  );

  const paymentsPanel = (
    <div className="space-y-4 pb-24 md:hidden">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">待跟進</h3>
        {unpaidPayments.length === 0 ? (
          <p className="mt-2 rounded-xl border border-ink/10 bg-surface px-4 py-4 text-center text-sm text-ink/50">
            暫無待付款／缺收據記錄。
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {unpaidPayments.map((row) => (
              <article key={`unpaid-${row.student_id}-${row.course_id}`} className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                <div className="font-medium text-ink">{row.student_name}</div>
                <div className="text-xs text-ink/50">{row.student_phone}</div>
                <div className="mt-2 text-sm text-ink/80">{row.course_title}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 font-medium text-amber-950">Pending</span>
                  <span className="text-ink/70">{row.installment_status}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">已付款</h3>
        {paidPayments.length === 0 ? (
          <p className="mt-2 rounded-xl border border-ink/10 bg-surface px-4 py-4 text-center text-sm text-ink/50">
            暫無已付款記錄。
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {paidPayments.map((row) => (
              <article key={`paid-${row.student_id}-${row.course_id}`} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
                <div className="font-medium text-ink">{row.student_name}</div>
                <div className="text-xs text-ink/50">{row.student_phone}</div>
                <div className="mt-2 text-sm text-ink/80">{row.course_title}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">Paid</span>
                  <span className="text-ink/70">{row.installment_status}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const paymentsPanelDesktop = (
    <div className="hidden space-y-6 pb-24 md:block">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">待跟進</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs text-ink/55">
                <th className="px-2 py-2 font-medium">學員</th>
                <th className="px-2 py-2 font-medium">課程</th>
                <th className="px-2 py-2 font-medium">付款</th>
                <th className="px-2 py-2 font-medium">分期</th>
              </tr>
            </thead>
            <tbody>
              {unpaidPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-ink/50">
                    暫無待付款／缺收據記錄。
                  </td>
                </tr>
              ) : (
                unpaidPayments.map((row) => (
                  <tr key={`unpaid-${row.student_id}-${row.course_id}`} className="border-b border-ink/[0.06]">
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-ink">{row.student_name}</div>
                      <div className="text-xs text-ink/50">{row.student_phone}</div>
                    </td>
                    <td className="px-2 py-2.5 text-ink/80">{row.course_title}</td>
                    <td className="px-2 py-2.5">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Pending</span>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-ink/70">{row.installment_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">已付款</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs text-ink/55">
                <th className="px-2 py-2 font-medium">學員</th>
                <th className="px-2 py-2 font-medium">課程</th>
                <th className="px-2 py-2 font-medium">付款</th>
                <th className="px-2 py-2 font-medium">分期</th>
              </tr>
            </thead>
            <tbody>
              {paidPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-ink/50">
                    暫無已付款記錄。
                  </td>
                </tr>
              ) : (
                paidPayments.map((row) => (
                  <tr key={`paid-${row.student_id}-${row.course_id}`} className="border-b border-ink/[0.06]">
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-ink">{row.student_name}</div>
                      <div className="text-xs text-ink/50">{row.student_phone}</div>
                    </td>
                    <td className="px-2 py-2.5 text-ink/80">{row.course_title}</td>
                    <td className="px-2 py-2.5">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Paid</span>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-ink/70">{row.installment_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const studentsPanel = (
    <div className="space-y-4 pb-24">
      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">我的學員</h2>
            <p className="mt-1 text-xs text-ink/55">查閱上堂記錄、代排時段，或替學員報 Course。</p>
          </div>
          <Link
            href="/coach-portal/reg-course"
            className="rounded-lg bg-primary/90 px-3 py-2 text-xs font-semibold text-ink"
          >
            報 Course
          </Link>
        </div>
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">暫無指派學員。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {students.map((s) => (
              <li key={s.student_id}>
                <button
                  type="button"
                  onClick={() => void loadStudentRecords(s.student_id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                    selectedStudentId === s.student_id
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-ink/10 bg-canvas hover:border-primary/40"
                  }`}
                >
                  <div className="font-medium text-ink">{s.full_name}</div>
                  <div className="mt-0.5 text-xs text-ink/60">
                    餘 {s.lesson_balance} 堂 · {s.enrollment_count} 課程
                    {s.pending_schedule ? " · 待排程" : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recordsLoading ? (
        <p className="text-sm text-ink/50">載入學員記錄…</p>
      ) : null}

      {studentRecords ? (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">
            {studentRecords.full_name} · 餘 {studentRecords.lesson_balance} 堂
          </h3>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/50">課程 / 分期</h4>
            <ul className="mt-2 space-y-3">
              {studentRecords.enrollments.map((enr) => (
                <li key={enr.enrollment_id} className="rounded-lg border border-ink/10 bg-canvas p-3 text-sm">
                  <div className="font-medium text-ink">{enr.course_title}</div>
                  <div className="mt-1 text-xs text-ink/60">
                    {enr.coach_time_confirmed
                      ? `${new Date(enr.scheduled_start).toLocaleString("zh-HK")} · ${enr.total_lessons} 堂`
                      : "待排程"}
                    {" · "}
                    {enr.installment_status} ({enr.payment_status})
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {enr.payment_status !== "Paid" ? (
                      <button
                        type="button"
                        disabled={remindBusy === enr.enrollment_id}
                        onClick={() => void sendPaymentReminder(studentRecords.student_id, enr.enrollment_id)}
                        className="rounded-md border border-emerald-600/40 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900"
                      >
                        WhatsApp 催款
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setBookingEnrollmentId(enr.enrollment_id);
                        setBookDay(enr.coach_time_confirmed ? localDateKey(enr.scheduled_start) : todayKey());
                      }}
                      className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-ink"
                    >
                      {enr.coach_time_confirmed ? "改期" : "排程"} 1–2h
                    </button>
                  </div>
                  {bookingEnrollmentId === enr.enrollment_id ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink/10 pt-3">
                      <label className="text-xs text-ink/70">
                        日期
                        <input
                          type="date"
                          value={bookDay}
                          onChange={(e) => setBookDay(e.target.value)}
                          className="mt-1 block rounded-lg border border-ink/15 bg-surface px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-ink/70">
                        開始
                        <select
                          value={bookStartHour}
                          onChange={(e) => setBookStartHour(Number(e.target.value))}
                          className="mt-1 block rounded-lg border border-ink/15 bg-surface px-2 py-1 text-sm"
                        >
                          {HOURS.filter((h) => !slotWouldConflict(bookOccupiedForStudent, h, bookDuration)).map((h) => (
                            <option key={h} value={h}>
                              {pad2(h)}:00
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-ink/70">
                        時長
                        <select
                          value={bookDuration}
                          onChange={(e) => setBookDuration(Number(e.target.value) as 1 | 2)}
                          className="mt-1 block rounded-lg border border-ink/15 bg-surface px-2 py-1 text-sm"
                        >
                          {[1, 2]
                            .filter((d) => !slotWouldConflict(bookOccupiedForStudent, bookStartHour, d))
                            .map((d) => (
                              <option key={d} value={d}>
                                {d} 小時
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={bookBusy || slotWouldConflict(bookOccupiedForStudent, bookStartHour, bookDuration)}
                        onClick={() => void bookEnrollment(enr.enrollment_id, enr.coach_time_confirmed)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {bookBusy ? "…" : "確認"}
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/50">上堂記錄（簽到）</h4>
            {studentRecords.attendance.length === 0 && studentRecords.checkins.length === 0 ? (
              <p className="mt-2 text-xs text-ink/45">暫無上堂記錄。</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-ink/75">
                {studentRecords.attendance.map((a) => (
                  <li key={`att-${a.id}`}>
                    {a.session_calendar_date} · {a.course_title ?? "課堂"} ·{" "}
                    {new Date(a.attended_at).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}
                  </li>
                ))}
                {studentRecords.checkins.map((c) => (
                  <li key={`chk-${c.id}`}>
                    {new Date(c.created_at).toLocaleString("zh-HK")} · {c.channel}
                    {c.remarks ? ` · ${c.remarks}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-3 py-4 pb-24 md:max-w-2xl md:px-4">
        {paymentUrgent.length > 0 ? (
          <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <p className="font-semibold">付款提醒 · {paymentUrgent.length} 位學員待跟進</p>
            <p className="mt-1 text-xs text-amber-900/85">
              請主動聯絡以下學員安排付款：
              {" "}
              {paymentUrgent.slice(0, 4).map((p) => p.student_name).join("、")}
              {paymentUrgent.length > 4 ? ` 等 ${paymentUrgent.length} 人` : ""}
            </p>
            <button
              type="button"
              onClick={() => setTab("students")}
              className="mt-2 text-xs font-semibold text-amber-900 underline"
            >
              前往學員分頁 WhatsApp 催款 →
            </button>
          </section>
        ) : null}
        {status ? (
          <p className="mb-3 rounded-lg border border-ink/10 bg-surface px-3 py-2 text-xs text-ink/70">{status}</p>
        ) : null}

        {tab === "schedule" ? schedulePanel : null}
        {tab === "students" ? studentsPanel : null}
        {tab === "payments" ? (
          <>
            {paymentsPanel}
            {paymentsPanelDesktop}
          </>
        ) : null}

        <nav
          className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-ink/10 bg-surface p-1.5"
          aria-label="教練工作台"
        >
          {(
            [
              { id: "schedule" as Tab, label: "排程", icon: "▣" },
              { id: "students" as Tab, label: "學員", icon: "👤" },
              { id: "payments" as Tab, label: "付款", icon: "◎" }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-[11px] font-semibold ${
                tab === item.id
                  ? "bg-primary/15 text-ink ring-1 ring-primary/30"
                  : "text-ink/65 hover:bg-canvas"
              }`}
            >
              <span className="text-[16px] leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
  );
}
