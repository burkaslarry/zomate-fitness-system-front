"use client";

/**
 * [F003][S001]
 * Feature: Coach Dashboard
 * Step: Auth gate, pending queue, hourly calendar (9–19), payments, signature update
 * Logic: COACH-only; scheduling via enrollment.coach_time_confirmed; strict slot blocking.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import CoachScheduleCalendarNav, { type CalendarMode } from "../../components/coach-schedule-calendar-nav";
import CoachScheduleBottomSheet from "../../components/coach-schedule-bottom-sheet";
import CoachScheduleDayAgenda from "../../components/coach-schedule-day-agenda";
import CoachScheduleFab from "../../components/coach-schedule-fab";
import CoachScheduleStudentPickerSheet from "../../components/coach-schedule-student-picker-sheet";
import CoachScheduleSuccessDialog from "../../components/coach-schedule-success-dialog";
import CoachDateStepper from "../../components/coach-date-stepper";
import CoachSlotDurationChips from "../../components/coach-slot-duration-chips";
import CoachStartEndSummary from "../../components/coach-start-end-summary";
import CoachStartTimeSelect from "../../components/coach-start-time-select";
import { monthRange, weekRange, isPastDay, todayDateKey } from "../../lib/coach-schedule-dates";
import {
  type CoachSlotDuration,
  type CoachStartMinute,
  rangesForDayFromSessions,
  slotWouldConflict,
  startSlotDecimal
} from "../../lib/coach-schedule-duration";
import {
  type CoachSessionRow,
  sessionsToDayCourses
} from "../../lib/coach-sessions";
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
type Tab = "schedule" | "students" | "payments";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayKey(): string {
  return todayDateKey();
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

function slotConflictForDay(
  sessions: CoachSessionRow[],
  day: string,
  excludeEnrollmentIds: Set<number>,
  startHour: number,
  startMinute: number,
  durationHours: number
): boolean {
  return slotWouldConflict(
    rangesForDayFromSessions(sessions, day, excludeEnrollmentIds, { confirmedOnly: true }),
    startSlotDecimal(startHour, startMinute),
    durationHours
  );
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

function tabFromParams(raw: string | null): Tab {
  if (raw === "students" || raw === "payments") return raw;
  return "schedule";
}

export default function CoachDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromParams(searchParams.get("tab"));
  const [authOk, setAuthOk] = useState(false);
  const [roleDenied, setRoleDenied] = useState(false);
  const [coach, setCoach] = useState<CoachMe | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [rangeSessions, setRangeSessions] = useState<CoachSessionRow[]>([]);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [daySessions, setDaySessions] = useState<CoachSessionRow[]>([]);
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [selectedPending, setSelectedPending] = useState<PendingRow | null>(null);
  const [startHour, setStartHour] = useState<number>(9);
  const [startMinute, setStartMinute] = useState<CoachStartMinute>(0);
  const [durationHours, setDurationHours] = useState<CoachSlotDuration>(1);
  const [scheduling, setScheduling] = useState(false);
  const [status, setStatus] = useState("");
  const [students, setStudents] = useState<CoachStudentBriefDto[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentRecords, setStudentRecords] = useState<CoachStudentRecordDto | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [bookingEnrollmentId, setBookingEnrollmentId] = useState<number | null>(null);
  const [bookDay, setBookDay] = useState(todayKey);
  const [bookDaySessions, setBookDaySessions] = useState<CoachSessionRow[]>([]);
  const [bookStartHour, setBookStartHour] = useState(9);
  const [bookStartMinute, setBookStartMinute] = useState<CoachStartMinute>(0);
  const [bookDuration, setBookDuration] = useState<CoachSlotDuration>(1);
  const [bookBusy, setBookBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState<number | null>(null);
  const [remindBusy, setRemindBusy] = useState<number | null>(null);
  const [scheduleStudentId, setScheduleStudentId] = useState<number | null>(null);
  const [pickBusy, setPickBusy] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState<{
    studentName: string;
    courseTitle: string;
    day: string;
    startHour: number;
    startMinute: CoachStartMinute;
    durationHours: CoachSlotDuration;
  } | null>(null);

  const pendingCourseIds = useMemo(() => new Set(pending.map((p) => p.course_id)), [pending]);
  const excludeCourseIds = useMemo(() => {
    const ids = new Set(pendingCourseIds);
    if (selectedPending) ids.add(selectedPending.enrollment_id);
    return ids;
  }, [pendingCourseIds, selectedPending]);
  const occupiedRanges = useMemo(
    () => rangesForDayFromSessions(daySessions, selectedDay, excludeCourseIds, { confirmedOnly: true }),
    [daySessions, selectedDay, excludeCourseIds]
  );

  const dayCoursesForPanel = useMemo(
    () =>
      sessionsToDayCourses(
        daySessions.filter((s) => !excludeCourseIds.has(s.enrollment_id)),
        selectedDay
      ),
    [daySessions, selectedDay, excludeCourseIds]
  );

  const confirmedDaySessions = useMemo(
    () =>
      daySessions.filter(
        (s) => s.coach_time_confirmed && !pendingCourseIds.has(s.enrollment_id)
      ),
    [daySessions, pendingCourseIds]
  );

  const unpaidPayments = useMemo(() => {
    return payments.filter((p) => p.payment_status === "Pending" || p.payment_status === "Overdue");
  }, [payments]);

  const paymentUrgent = unpaidPayments;

  const paidPayments = useMemo(() => payments.filter((p) => p.payment_status === "Paid"), [payments]);

  const bookExcludeIds = useMemo(
    () =>
      bookingEnrollmentId ? new Set([...pendingCourseIds, bookingEnrollmentId]) : pendingCourseIds,
    [pendingCourseIds, bookingEnrollmentId]
  );


  const reloadAll = useCallback(async (coachId: number) => {
    const [pList, payList, sList, studentsList] = await Promise.all([
      api.coachPendingStudents(coachId) as Promise<PendingRow[]>,
      api.coachStudentPayments(coachId) as Promise<PaymentRow[]>,
      api.coachSessions(coachId, { day: selectedDay }) as Promise<CoachSessionRow[]>,
      api.coachStudents(coachId) as Promise<CoachStudentBriefDto[]>
    ]);
    setPending(pList ?? []);
    setPayments(payList ?? []);
    setDaySessions(sList ?? []);
    setStudents(studentsList ?? []);
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
      .coachSessions(coach.id, { day: selectedDay })
      .then((rows) => setDaySessions((rows ?? []) as CoachSessionRow[]))
      .catch((e) => setStatus(String(e)));
  }, [coach, selectedDay]);

  useEffect(() => {
    if (!coach || bookingEnrollmentId == null) {
      setBookDaySessions([]);
      return;
    }
    void api
      .coachSessions(coach.id, { day: bookDay })
      .then((rows) => setBookDaySessions((rows ?? []) as CoachSessionRow[]))
      .catch(() => setBookDaySessions([]));
  }, [coach, bookDay, bookingEnrollmentId]);

  useEffect(() => {
    if (!coach) return;
    const range = calendarMode === "week" ? weekRange(selectedDay) : monthRange(selectedDay);
    void api
      .coachSessions(coach.id, { fromDate: range.from, toDate: range.to })
      .then((rows) => setRangeSessions((rows ?? []) as CoachSessionRow[]))
      .catch(() => setRangeSessions([]));
  }, [coach, calendarMode, selectedDay]);

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
          const d = new Date(target.scheduled_start);
          setSelectedDay(localDateKey(target.scheduled_start));
          setStartHour(d.getHours());
          setStartMinute((Math.round(d.getMinutes() / 15) * 15) as CoachStartMinute);
        } else {
          setSelectedDay(isPastDay(selectedDay) ? todayKey() : selectedDay);
          setStartHour(9);
          setStartMinute(0);
          setDurationHours(1);
        }
        setScheduleSheetOpen(false);
      } catch (e) {
        setScheduleStudentId(null);
        alertApiError(e);
        setStatus(String(e));
      } finally {
        setPickBusy(false);
      }
    },
    [coach, selectedDay]
  );

  useEffect(() => {
    if (!selectedPending) {
      setScheduleStudentId(null);
      return;
    }
    setScheduleStudentId(selectedPending.student_id);
  }, [selectedPending]);

  const handleCalendarDaySelect = useCallback((dayKey: string) => {
    setSelectedDay(dayKey);
    setScheduleSheetOpen(false);
    setStudentPickerOpen(false);
  }, []);

  const handleSelectPendingRow = useCallback((row: PendingRow) => {
    setSelectedPending(row);
    setScheduleStudentId(row.student_id);
    setScheduleSheetOpen(false);
    setStartHour(9);
    setStartMinute(0);
    setDurationHours(1);
  }, []);

  const handleFabClick = useCallback(() => {
    if (isPastDay(selectedDay)) {
      setStatus("不能排期到過去日期，請選今日或未來。");
      return;
    }
    if (selectedPending) {
      setScheduleSheetOpen(true);
      return;
    }
    setStudentPickerOpen(true);
  }, [selectedDay, selectedPending]);

  const handlePickerPending = useCallback(
    (row: PendingRow) => {
      handleSelectPendingRow(row);
      setStudentPickerOpen(false);
      setScheduleSheetOpen(true);
    },
    [handleSelectPendingRow]
  );

  const handlePickerStudent = useCallback(
    (studentId: number) => {
      setStudentPickerOpen(false);
      void pickStudentForSchedule(studentId).then(() => {
        setScheduleSheetOpen(true);
      });
    },
    [pickStudentForSchedule]
  );

  async function confirmSchedule() {
    if (!coach || !selectedPending) return;
    if (isPastDay(selectedDay)) {
      setStatus("不能排期到過去日期，請選今日或未來。");
      return;
    }
    if (
      slotConflictForDay(
        daySessions,
        selectedDay,
        excludeCourseIds,
        startHour,
        startMinute,
        durationHours
      )
    ) {
      setStatus("此時段已被佔用或超出 19:00，請另選。");
      return;
    }
    setScheduling(true);
    setStatus("");
    const booked = {
      studentName: selectedPending.student_name,
      courseTitle: selectedPending.course_title,
      day: selectedDay,
      startHour: startSlotDecimal(startHour, startMinute),
      startMinute,
      durationHours
    };
    try {
      await api.coachBookSession({
        enrollment_id: selectedPending.enrollment_id,
        day: selectedDay,
        start_hour: startHour,
        start_minute: startMinute,
        duration_hours: durationHours,
        coach_id: coach.id
      });
      setSelectedPending(null);
      setScheduleStudentId(null);
      setScheduleSheetOpen(false);
      await reloadAll(coach.id);
      setScheduleSuccess(booked);
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

  async function openStudentReschedule(studentId: number, enrollmentId: number) {
    router.push("/coach-portal?tab=students");
    await loadStudentRecords(studentId);
    setBookingEnrollmentId(enrollmentId);
    setBookDay(todayKey());
    setBookStartHour(9);
    setBookStartMinute(0);
    setBookDuration(1);
  }

  async function bookEnrollment(enrollmentId: number, confirmed: boolean) {
    if (!coach) return;
    if (isPastDay(bookDay)) {
      setStatus("不能排期到過去日期，請選今日或未來。");
      return;
    }
    const bookExclude = new Set([...pendingCourseIds, enrollmentId]);
    if (
      slotConflictForDay(
        bookDaySessions,
        bookDay,
        bookExclude,
        bookStartHour,
        bookStartMinute,
        bookDuration
      )
    ) {
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
        start_minute: bookStartMinute,
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

  async function cancelEnrollment(studentId: number, enrollmentId: number, courseTitle: string) {
    if (!coach) return;
    const ok = window.confirm(`確定要取消「${courseTitle}」？此課程將從日曆移除。`);
    if (!ok) return;
    setCancelBusy(enrollmentId);
    setStatus("");
    try {
      await api.coachCancelEnrollment(enrollmentId, { coach_id: coach.id });
      if (bookingEnrollmentId === enrollmentId) setBookingEnrollmentId(null);
      await reloadAll(coach.id);
      await loadStudentRecords(studentId);
      setStatus("已取消課程。");
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setCancelBusy(null);
    }
  }

  function handleScheduleSuccessGoStudents() {
    setScheduleSuccess(null);
    router.push("/coach-portal?tab=students");
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
    <div className="relative space-y-4 pb-8">
      {pending.length > 0 ? (
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-3 shadow-sm">
          <p className="text-xs font-semibold text-ink">
            待排期 · {pending.length} 位學員
          </p>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {pending.map((p) => (
              <li key={p.enrollment_id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => handlePickerPending(p)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selectedPending?.enrollment_id === p.enrollment_id
                      ? "border-primary bg-primary/20 text-black"
                      : "border-ink/15 bg-surface text-ink hover:border-primary/35"
                  }`}
                >
                  {p.student_name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">日曆 · 學員上堂</h2>
        <p className="mt-1 text-xs text-ink/55">Google Calendar 模式：月／週檢視 · 點日期 · 下方列出當日全部課堂</p>
        <CoachScheduleCalendarNav
          selectedDay={selectedDay}
          mode={calendarMode}
          rangeSessions={rangeSessions}
          onSelectDay={handleCalendarDaySelect}
          onModeChange={setCalendarMode}
          onNavigate={handleCalendarDaySelect}
        />
        <CoachScheduleDayAgenda
          selectedDay={selectedDay}
          sessions={confirmedDaySessions}
          isPastDay={isPastDay(selectedDay)}
          onReschedule={(studentId, enrollmentId) => void openStudentReschedule(studentId, enrollmentId)}
        />
      </section>

      {selectedPending ? (
        <CoachScheduleBottomSheet
          open={scheduleSheetOpen}
          studentName={selectedPending.student_name}
          courseTitle={selectedPending.course_title}
          selectedDay={selectedDay}
          dayCourses={dayCoursesForPanel}
          occupiedRanges={occupiedRanges}
          startHour={startHour}
          startMinute={startMinute}
          durationHours={durationHours}
          scheduling={scheduling}
          onClose={() => setScheduleSheetOpen(false)}
          onDayChange={setSelectedDay}
          onStartTimeChange={(h, m) => {
            setStartHour(h);
            setStartMinute(m);
          }}
          onDurationChange={setDurationHours}
          onConfirm={() => void confirmSchedule()}
        />
      ) : null}

      <CoachScheduleStudentPickerSheet
        open={studentPickerOpen}
        pending={pending}
        students={students}
        busy={pickBusy}
        onClose={() => setStudentPickerOpen(false)}
        onPickPending={(row) =>
          handlePickerPending({
            enrollment_id: row.enrollment_id,
            course_id: row.course_id ?? row.enrollment_id,
            student_id: row.student_id,
            student_name: row.student_name,
            student_phone: row.student_phone ?? "",
            course_title: row.course_title,
            branch_name: row.branch_name,
            total_lessons: row.total_lessons,
            placeholder_start: row.placeholder_start ?? ""
          })
        }
        onPickStudent={handlePickerStudent}
      />

      <CoachScheduleFab onClick={handleFabClick} disabled={isPastDay(selectedDay)} />
    </div>
  );

  const paymentsPanel = (
    <div className="space-y-4 md:hidden">
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
    <div className="hidden space-y-6 md:block">
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
    <div className="space-y-4">
      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">我的學員</h2>
            <p className="mt-1 text-xs text-ink/55">查閱上堂記錄、代排時段，或替學員報 Course。</p>
          </div>
          <Link
            href="/coach-portal/reg-course"
            className="rounded-lg bg-primary/90 px-3 py-2 text-xs font-semibold text-black"
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
                        setBookDay(todayKey());
                        setBookStartHour(9);
                        setBookStartMinute(0);
                        setBookDuration(1);
                      }}
                      className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-black"
                    >
                      {enr.coach_time_confirmed ? "改期" : "排程"} 0.5–2h
                    </button>
                    <button
                      type="button"
                      disabled={cancelBusy === enr.enrollment_id}
                      onClick={() =>
                        void cancelEnrollment(
                          studentRecords.student_id,
                          enr.enrollment_id,
                          enr.course_title
                        )
                      }
                      className="rounded-md border border-red-300/70 bg-red-50 px-2 py-1 text-xs font-medium text-red-900 disabled:opacity-50"
                    >
                      {cancelBusy === enr.enrollment_id ? "…" : "取消課程"}
                    </button>
                  </div>
                  {bookingEnrollmentId === enr.enrollment_id ? (
                    <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
                      <div>
                        <p className="mb-1 text-xs text-ink/70">日期</p>
                        <CoachDateStepper value={bookDay} onChange={setBookDay} minDate={todayKey()} />
                      </div>
                      <CoachStartTimeSelect
                        startHour={bookStartHour}
                        startMinute={bookStartMinute}
                        durationHours={bookDuration}
                        occupiedRanges={rangesForDayFromSessions(bookDaySessions, bookDay, bookExcludeIds, {
                          confirmedOnly: true
                        })}
                        onChange={(h, m) => {
                          setBookStartHour(h);
                          setBookStartMinute(m);
                        }}
                      />
                      <CoachStartEndSummary
                        startHour={startSlotDecimal(bookStartHour, bookStartMinute)}
                        durationHours={bookDuration}
                      />
                      <CoachSlotDurationChips
                        name={`book-duration-${enr.enrollment_id}`}
                        startHour={startSlotDecimal(bookStartHour, bookStartMinute)}
                        durationHours={bookDuration}
                        occupiedRanges={rangesForDayFromSessions(bookDaySessions, bookDay, bookExcludeIds, {
                          confirmedOnly: true
                        })}
                        onChange={setBookDuration}
                      />
                      <button
                        type="button"
                        disabled={
                          bookBusy ||
                          slotConflictForDay(
                            bookDaySessions,
                            bookDay,
                            bookExcludeIds,
                            bookStartHour,
                            bookStartMinute,
                            bookDuration
                          )
                        }
                        onClick={() => void bookEnrollment(enr.enrollment_id, enr.coach_time_confirmed)}
                        className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-black disabled:opacity-50 sm:w-auto"
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
    <>
      <div className="mx-auto max-w-lg px-3 py-4 md:max-w-2xl md:px-4">
        {paymentUrgent.length > 0 ? (
          <section className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <p className="font-semibold">付款提醒 · {paymentUrgent.length} 位學員待跟進</p>
            <p className="mt-1 text-xs text-amber-900/85">
              請主動聯絡以下學員安排付款：
              {" "}
              {paymentUrgent.slice(0, 4).map((p) => p.student_name).join("、")}
              {paymentUrgent.length > 4 ? ` 等 ${paymentUrgent.length} 人` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <Link href="/coach-portal?tab=payments" className="text-amber-900 underline">
                前往已付分頁 →
              </Link>
              <Link href="/coach-portal?tab=students" className="text-amber-900 underline">
                學員 · WhatsApp 催款 →
              </Link>
            </div>
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
      </div>

      <CoachScheduleSuccessDialog
        open={scheduleSuccess != null}
        studentName={scheduleSuccess?.studentName ?? ""}
        courseTitle={scheduleSuccess?.courseTitle ?? ""}
        day={scheduleSuccess?.day ?? todayKey()}
        startHour={scheduleSuccess?.startHour ?? 9}
        durationHours={scheduleSuccess?.durationHours ?? 1}
        onGoStudents={handleScheduleSuccessGoStudents}
      />
    </>
  );
}
