"use client";

/**
 * [F003][S001] / [F008][S005] / [F004][S002]
 * Feature: Coach Dashboard
 * Step: Schedule, students (search / collapse packages), payments (分期收據上載)
 * Logic: COACH-only; plain student names; branch on package; unpaid 第2／第3期 upload buttons.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CoachBottomSheet from "../../components/coach-bottom-sheet";
import CoachScheduleCalendarNav, { type CalendarMode } from "../../components/coach-schedule-calendar-nav";
import CoachScheduleBottomSheet from "../../components/coach-schedule-bottom-sheet";
import CoachScheduleDayAgenda from "../../components/coach-schedule-day-agenda";
import CoachScheduleFab from "../../components/coach-schedule-fab";
import CoachScheduleStudentPickerSheet from "../../components/coach-schedule-student-picker-sheet";
import CoachSchedulePackagePickerSheet, {
  type PackagePickRow
} from "../../components/coach-schedule-package-picker-sheet";
import CoachScheduleSuccessDialog from "../../components/coach-schedule-success-dialog";
import CoachCancelConfirmDialog from "../../components/coach-cancel-confirm-dialog";
import CoachDateStepper from "../../components/coach-date-stepper";
import CoachSlotDurationChips from "../../components/coach-slot-duration-chips";
import CoachStartEndSummary from "../../components/coach-start-end-summary";
import CoachStartTimeSelect from "../../components/coach-start-time-select";
import { monthRange, weekRange, shiftDay, isPastDay, todayDateKey } from "../../lib/coach-schedule-dates";
import {
  type CoachSlotDuration,
  type CoachStartMinute,
  slotWouldConflict,
  startSlotDecimal
} from "../../lib/coach-schedule-duration";
import {
  type CoachSessionRow,
  sessionsToDayCourses
} from "../../lib/coach-sessions";
import { alertApiError, api, apiAssetUrl, downloadBlobFile, formatApiError } from "../../lib/api";
import { getAuthSession } from "../../lib/auth";
import { formatHktDateTime } from "../../lib/format-hkt";
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
  unpaid_installment_nos?: number[];
  /** [F004][S002] Category plan row; uploads use installment_plan_id instead of course_id. */
  installment_plan_id?: number | null;
  installment_source?: "course" | "category";
  /** [F004][S002] Proof uploaded — waiting for Admin 確認付款. */
  pending_installment_nos?: number[];
  signature_image_url: string | null;
  receipt_available?: boolean;
};
type Tab = "schedule" | "students" | "payments";

/** [F004][S002] Stable row id: course rows use course_id, category plan rows use plan id. */
function paymentRowKey(row: PaymentRow): string {
  return row.installment_plan_id ? `plan-${row.installment_plan_id}` : `course-${row.course_id}`;
}

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

/** [F003][S004] Authorized first bookings may start today; the API rejects ended slots. */
function bookingMinDateKey(): string {
  return todayDateKey();
}

/** [F003][S009] Build a local wall-clock datetime accepted by the booking API. */
function localSlotIso(day: string, hour: number, minute: number): string {
  return `${day}T${pad2(hour)}:${pad2(minute)}:00`;
}

/** [F003][S003] Build wa.me link with polite payment reminder. */
function remindPayWaLink(phone: string, name: string, courseTitle: string): string {
  // Country code lives on student.phone in DB (+852…); do not invent here.
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "";
  const text = encodeURIComponent(
    `【Zomate Fitness】${name} 你好，溫馨提醒：你的課程「${courseTitle}」尚有款項待付，請盡快安排付款。如有疑問請聯絡我們，謝謝！`
  );
  return `https://wa.me/${digits}?text=${text}`;
}

/** [F003][S005] Q4.2 — re-open receipt / proof files uploaded by coach or student. */
function CoachReceiptPreview({ fileUrl, label }: { fileUrl: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl.split("?")[0].toLowerCase());
  if (!isImage || failed) {
    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block text-xs font-medium text-primary underline"
      >
        {failed ? "預覽失敗，開啟檔案" : "開啟檔案（PDF／其他）"}
      </a>
    );
  }
  return (
    <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-1 block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fileUrl}
        alt={label}
        className="max-h-40 w-full rounded border border-ink/10 object-contain"
        onError={() => setFailed(true)}
      />
    </a>
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
  /** [F003][S003] Student holds several packages — coach picks one before the time sheet. */
  const [packagePick, setPackagePick] = useState<{
    studentId: number;
    studentName: string;
    studentPhone: string;
    packages: PackagePickRow[];
  } | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [receiptPdfBusyCourseId, setReceiptPdfBusyCourseId] = useState<number | null>(null);
  const [daySessions, setDaySessions] = useState<CoachSessionRow[]>([]);
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [selectedPending, setSelectedPending] = useState<PendingRow | null>(null);
  const [startHour, setStartHour] = useState<number>(9);
  const [startMinute, setStartMinute] = useState<CoachStartMinute>(0);
  const [durationHours, setDurationHours] = useState<CoachSlotDuration>(1);
  const [scheduling, setScheduling] = useState(false);
  const [status, setStatus] = useState("");
  const [students, setStudents] = useState<CoachStudentBriefDto[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentRecords, setStudentRecords] = useState<CoachStudentRecordDto | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const selectedStudentRef = useRef<number | null>(null);
  const studentSelectionRef = useRef(0);
  const recordsRequestRef = useRef(0);
  const studentSheetRef = useRef<HTMLDivElement>(null);
  const studentTriggerRef = useRef<HTMLElement | null>(null);
  const [receiptUploadBusyKey, setReceiptUploadBusyKey] = useState<string | null>(null);
  const [bookingEnrollmentId, setBookingEnrollmentId] = useState<number | null>(null);
  const [bookingCategoryId, setBookingCategoryId] = useState<number | null>(null);
  const [bookingOriginalDate, setBookingOriginalDate] = useState<string | null>(null);
  const [bookDay, setBookDay] = useState(todayKey);
  const [bookStartHour, setBookStartHour] = useState(9);
  const [bookStartMinute, setBookStartMinute] = useState<CoachStartMinute>(0);
  const [bookDuration, setBookDuration] = useState<CoachSlotDuration>(1);
  const [bookBusy, setBookBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{
    scope: "session" | "course";
    enrollmentId: number;
    studentId: number;
    studentName: string;
    courseTitle: string;
    originalDate?: string;
    sessionLabel?: string;
    /** [F003][S009] Q4/Q4.1 — never-scheduled package being deleted. */
    pending?: boolean;
  } | null>(null);
  const [remindBusy, setRemindBusy] = useState<number | null>(null);
  const [scheduleStudentId, setScheduleStudentId] = useState<number | null>(null);
  /** [F003][S007] FAB flow booking a legacy paper ledger instead of an existing Course. */
  const [scheduleCategoryId, setScheduleCategoryId] = useState<number | null>(null);
  /** [F003][S003] FAB「其他事項」— private calendar block, no student enrollment. */
  const [personalBlockMode, setPersonalBlockMode] = useState(false);
  /** [F003][S003] FAB「新增學生試堂」— new student name + phone + optional note. */
  const [trialDraft, setTrialDraft] = useState<{ name: string; phone: string; notes: string } | null>(null);
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

  /** [F008][S005] Payments tab search — same behaviour as the students tab search. */
  const paymentMatches = useCallback((row: PaymentRow, q: string) => {
    const name = (row.student_name || "").toLowerCase();
    const phone = (row.student_phone || "").replace(/\D/g, "");
    const title = (row.course_title || "").toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return (
      name.includes(q) ||
      title.includes(q) ||
      (qDigits.length > 0 && phone.includes(qDigits))
    );
  }, []);

  const filteredUnpaidPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return unpaidPayments;
    return unpaidPayments.filter((p) => paymentMatches(p, q));
  }, [unpaidPayments, paymentSearch, paymentMatches]);

  const filteredPaidPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return paidPayments;
    return paidPayments.filter((p) => paymentMatches(p, q));
  }, [paidPayments, paymentSearch, paymentMatches]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = (s.full_name || "").toLowerCase();
      const phone = (s.phone || "").replace(/\D/g, "");
      const qDigits = q.replace(/\D/g, "");
      return name.includes(q) || (qDigits.length > 0 && phone.includes(qDigits));
    });
  }, [students, studentSearch]);

  const personalBlocksAsSessions = useCallback(
    async (coachId: number, params: { day?: string; fromDate?: string; toDate?: string }) => {
      try {
        const blocks = (await api.coachListPersonalBlocks({
          coach_id: coachId,
          day: params.day,
          from_date: params.fromDate,
          to_date: params.toDate
        })) as Array<{
          id: number;
          title: string;
          notes?: string | null;
          kind?: string;
          student_phone?: string | null;
          start_at: string;
          end_at: string;
        }>;
        return (blocks ?? []).map((b): CoachSessionRow => {
          const start = new Date(b.start_at);
          const end = new Date(b.end_at);
          const pad = (n: number) => String(n).padStart(2, "0");
          const y = start.getFullYear();
          const m = pad(start.getMonth() + 1);
          const d = pad(start.getDate());
          const isTrial = b.kind === "trial";
          return {
            enrollment_id: -b.id,
            student_id: 0,
            student_name: isTrial ? b.title : "其他事項",
            student_phone: b.student_phone ?? "",
            category_id: null,
            category_name: isTrial ? "試堂" : "其他事項",
            session_date: `${y}-${m}-${d}`,
            start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
            end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
            branch_name: "",
            checkin_pin: "",
            coach_time_confirmed: true,
            attendance_status: isTrial ? "試堂" : "personal",
            course_title: isTrial ? b.notes || "新學生試堂" : b.title || "其他事項"
          };
        });
      } catch {
        return [];
      }
    },
    []
  );

  const reloadCalendarRange = useCallback(
    async (coachId: number, dayKey: string, mode: CalendarMode) => {
      const month = monthRange(dayKey);
      const visible =
        mode === "week"
          ? weekRange(dayKey)
          : { from: dayKey, to: mode === "three-day" ? shiftDay(dayKey, 2) : dayKey };
      const range = {
        from: month.from < visible.from ? month.from : visible.from,
        to: month.to > visible.to ? month.to : visible.to
      };
      const [rows, personal] = await Promise.all([
        api.coachSessions(coachId, { fromDate: range.from, toDate: range.to }) as Promise<CoachSessionRow[]>,
        personalBlocksAsSessions(coachId, { fromDate: range.from, toDate: range.to })
      ]);
      setRangeSessions([...(rows ?? []), ...personal]);
    },
    [personalBlocksAsSessions]
  );

  const reloadAll = useCallback(async (coachId: number) => {
    const [pList, payList, sList, studentsList, personal] = await Promise.all([
      api.coachPendingStudents(coachId) as Promise<PendingRow[]>,
      api.coachStudentPayments(coachId) as Promise<PaymentRow[]>,
      api.coachSessions(coachId, { day: selectedDay }) as Promise<CoachSessionRow[]>,
      api.coachStudents(coachId) as Promise<CoachStudentBriefDto[]>,
      personalBlocksAsSessions(coachId, { day: selectedDay })
    ]);
    setPending(pList ?? []);
    setPayments(payList ?? []);
    setDaySessions([...(sList ?? []), ...personal]);
    setStudents(studentsList ?? []);
    // [F003][S003] Keep week/month calendar in sync after book / 其他事項 / cancel.
    await reloadCalendarRange(coachId, selectedDay, calendarMode);
  }, [selectedDay, calendarMode, personalBlocksAsSessions, reloadCalendarRange]);

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
    void Promise.all([
      api.coachSessions(coach.id, { day: selectedDay }) as Promise<CoachSessionRow[]>,
      personalBlocksAsSessions(coach.id, { day: selectedDay })
    ])
      .then(([rows, personal]) => setDaySessions([...(rows ?? []), ...personal]))
      .catch((e) => setStatus(String(e)));
  }, [coach, selectedDay, personalBlocksAsSessions]);

  useEffect(() => {
    if (!coach) return;
    // [F008][S005] Load one range covering the mini month and any cross-month visible days.
    const month = monthRange(selectedDay);
    const visible = calendarMode === "week" ? weekRange(selectedDay) : { from: selectedDay, to: calendarMode === "three-day" ? shiftDay(selectedDay, 2) : selectedDay };
    const range = { from: month.from < visible.from ? month.from : visible.from, to: month.to > visible.to ? month.to : visible.to };
    let active = true;
    void Promise.all([
      api.coachSessions(coach.id, { fromDate: range.from, toDate: range.to }) as Promise<CoachSessionRow[]>,
      personalBlocksAsSessions(coach.id, { fromDate: range.from, toDate: range.to })
    ])
      .then(([rows, personal]) => {
        if (active) setRangeSessions([...(rows ?? []), ...personal]);
      })
      .catch(() => {
        if (active) setRangeSessions([]);
      });
    return () => {
      active = false;
    };
  }, [coach, calendarMode, selectedDay, personalBlocksAsSessions]);

  const pickStudentForSchedule = useCallback(
    async (studentId: number): Promise<"sheet" | "packages" | null> => {
      if (!coach) return null;
      setScheduleStudentId(studentId);
      setPickBusy(true);
      setStatus("");
      try {
        const rec = (await api.coachStudentRecords(studentId, coach.id)) as CoachStudentRecordDto;
        /**
         * [F003][S007]
         * Feature: Attendance / legacy package convert
         * Step: 揀 Package options for one student
         * Logic: Skip paper ledgers that already have a live PIN shell enrollment —
         * otherwise one 10-堂 import shows as two packages (shell 總 inflated + ledger).
         */
        const linkedLedgerIds = new Set(
          (rec.enrollments ?? [])
            .map((e) => e.legacy_category_enrollment_id)
            .filter((id): id is number => typeof id === "number" && id > 0)
        );
        const ledgers = (rec.category_enrollments ?? []).filter(
          (row) =>
            row.scheduled_enrollment_id == null &&
            !row.scheduled_once &&
            row.remaining_from_paper > 0 &&
            !linkedLedgerIds.has(row.id)
        );
        const totalOptions = rec.enrollments.length + ledgers.length;
        if (totalOptions === 0) {
          setScheduleStudentId(null);
          setStatus("此學員暫無可排程課程。");
          return null;
        }
        if (totalOptions > 1) {
          // [F003][S003] One student can hold several packages — coach picks which one first.
          const brief = students.find((s) => s.student_id === studentId);
          const byId = new Map((brief?.packages ?? []).map((p) => [p.enrollment_id, p]));
          setScheduleStudentId(null);
          setPackagePick({
            studentId,
            studentName: rec.full_name,
            studentPhone: rec.phone,
            packages: [
              ...rec.enrollments.map((e) => {
                const p = byId.get(e.enrollment_id);
                const paper = e.legacy_prior_lessons ?? 0;
                // [F003][S007] A converted paper package only holds its remaining lessons;
                // add the paper 已上 count back so 總 matches the imported ledger (e.g. 13 + 17 = 30).
                return {
                  enrollment_id: e.enrollment_id,
                  kind: "enrollment" as const,
                  course_title: e.course_title,
                  branch_name: e.branch_name ?? null,
                  total_lessons: e.total_lessons + paper,
                  remaining_lessons: p ? p.remaining_lessons : e.total_lessons,
                  prior_lessons: paper,
                  coach_time_confirmed: e.coach_time_confirmed,
                  installment_status: e.installment_status,
                  periods: e.installment_periods ?? p?.installment_periods ?? []
                };
              }),
              ...ledgers.map((row) => ({
                enrollment_id: 0,
                kind: "ledger" as const,
                category_enrollment_id: row.id,
                course_title: `${row.category_name}（舊 package）`,
                branch_name: null,
                total_lessons: row.total_lessons,
                remaining_lessons: row.remaining_from_paper,
                coach_time_confirmed: false,
                installment_status: `已上 ${row.lessons_already_taken} 堂 · 剩 ${row.remaining_from_paper} 堂`,
                periods: []
              }))
            ]
          });
          return "packages";
        }
        if (ledgers.length === 1 && rec.enrollments.length === 0) {
          // [F003][S007] Only a legacy ledger left — book it straight from the time sheet.
          const only = ledgers[0];
          setScheduleCategoryId(only.id);
          setSelectedPending({
            enrollment_id: 0,
            course_id: 0,
            student_id: studentId,
            student_name: rec.full_name,
            student_phone: rec.phone,
            course_title: `${only.category_name}（舊 package 剩 ${only.remaining_from_paper} 堂）`,
            branch_name: "",
            total_lessons: only.total_lessons,
            placeholder_start: ""
          });
          setSelectedDay(isPastDay(selectedDay) ? todayKey() : selectedDay);
          setStartHour(9);
          setStartMinute(0);
          setDurationHours(1);
          setScheduleSheetOpen(false);
          return "sheet";
        }
        const target = rec.enrollments.find((e) => !e.coach_time_confirmed) ?? rec.enrollments[0];
        setScheduleCategoryId(null);
        setSelectedPending(
          pendingFromEnrollment(studentId, rec.full_name, rec.phone, {
            enrollment_id: target.enrollment_id,
            course_title: target.course_title,
            scheduled_start: target.scheduled_start,
            total_lessons: target.total_lessons
          })
        );
        // [F003][S009] Every next appointment is a new explicit booking, never an inferred weekly slot.
        setSelectedDay(isPastDay(selectedDay) ? todayKey() : selectedDay);
        setStartHour(9);
        setStartMinute(0);
        setDurationHours(1);
        setScheduleSheetOpen(false);
        return "sheet";
      } catch (e) {
        setScheduleStudentId(null);
        alertApiError(e);
        setStatus(String(e));
        return null;
      } finally {
        setPickBusy(false);
      }
    },
    [coach, selectedDay, students]
  );

  const handlePickPackage = useCallback(
    (row: PackagePickRow) => {
      if (!packagePick) return;
      setPackagePick(null);
      setPersonalBlockMode(false);
      setTrialDraft(null);
      // [F003][S007] Paper-ledger rows book via category-bookings, not an existing enrollment.
      const isLedger = row.kind === "ledger" && row.category_enrollment_id != null;
      setScheduleCategoryId(isLedger ? row.category_enrollment_id! : null);
      setSelectedPending({
        enrollment_id: row.enrollment_id,
        course_id: row.enrollment_id,
        student_id: packagePick.studentId,
        student_name: packagePick.studentName,
        student_phone: packagePick.studentPhone,
        course_title: row.course_title,
        branch_name: row.branch_name ?? "",
        total_lessons: row.total_lessons,
        placeholder_start: ""
      });
      if (isPastDay(selectedDay) || selectedDay < bookingMinDateKey()) setSelectedDay(bookingMinDateKey());
      setStartHour(9);
      setStartMinute(0);
      setDurationHours(1);
      setScheduleSheetOpen(true);
    },
    [packagePick, selectedDay]
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
    setPersonalBlockMode(false);
    setScheduleCategoryId(null);
    setSelectedPending(row);
    setScheduleStudentId(row.student_id);
    setScheduleSheetOpen(false);
    setSelectedDay(bookingMinDateKey());
    setStartHour(9);
    setStartMinute(0);
    setDurationHours(1);
  }, []);

  const handleFabClick = useCallback(() => {
    if (isPastDay(selectedDay)) {
      setStatus("不能排期到過去日期，請選今日或未來。");
      return;
    }
    // [F003][S003] Always let coach pick student / 其他事項 after + .
    setScheduleSheetOpen(false);
    setStudentPickerOpen(true);
  }, [selectedDay]);

  const openChangeSelection = useCallback(() => {
    setScheduleSheetOpen(false);
    setStudentPickerOpen(true);
  }, []);

  const handlePickPersonal = useCallback(() => {
    setPersonalBlockMode(true);
    setTrialDraft(null);
    setSelectedPending(null);
    setScheduleCategoryId(null);
    setScheduleStudentId(null);
    setStudentPickerOpen(false);
    if (selectedDay < bookingMinDateKey()) setSelectedDay(bookingMinDateKey());
    setStartHour(9);
    setStartMinute(0);
    setDurationHours(1);
    setScheduleSheetOpen(true);
  }, [selectedDay]);

  const handlePickTrial = useCallback(
    (trial: { name: string; phone: string; notes: string }) => {
      setTrialDraft(trial);
      setPersonalBlockMode(false);
      setSelectedPending(null);
      setScheduleCategoryId(null);
      setScheduleStudentId(null);
      setStudentPickerOpen(false);
      if (selectedDay < bookingMinDateKey()) setSelectedDay(bookingMinDateKey());
      setStartHour(9);
      setStartMinute(0);
      setDurationHours(1);
      setScheduleSheetOpen(true);
    },
    [selectedDay]
  );

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
      void pickStudentForSchedule(studentId).then((next) => {
        if (next === "sheet") setScheduleSheetOpen(true);
      });
    },
    [pickStudentForSchedule]
  );

  async function confirmSchedule() {
    if (!coach) return;
    if (isPastDay(selectedDay)) {
      setStatus("不能排期到過去日期，請選今日或未來。");
      return;
    }
    if (selectedDay < bookingMinDateKey()) {
      setStatus("首次排堂可選今日或未來日期。");
      return;
    }
    if (
      slotWouldConflict([], startSlotDecimal(startHour, startMinute), durationHours)
    ) {
      setStatus("排程不可超過當日 24:00，請另選。");
      return;
    }
    setScheduling(true);
    setStatus("");
    try {
      if (personalBlockMode) {
        await api.coachCreatePersonalBlock({
          day: selectedDay,
          start_hour: startHour,
          start_minute: startMinute,
          duration_hours: durationHours,
          title: "其他事項",
          coach_id: coach.id
        });
        setPersonalBlockMode(false);
        setScheduleSheetOpen(false);
        await reloadAll(coach.id);
        setStatus("已加入其他事項到日曆。");
        return;
      }
      if (trialDraft) {
        await api.coachCreatePersonalBlock({
          day: selectedDay,
          start_hour: startHour,
          start_minute: startMinute,
          duration_hours: durationHours,
          title: trialDraft.name,
          notes: trialDraft.notes || undefined,
          kind: "trial",
          student_phone: trialDraft.phone,
          coach_id: coach.id
        });
        setTrialDraft(null);
        setScheduleSheetOpen(false);
        await reloadAll(coach.id);
        setStatus(`已加入試堂：${trialDraft.name}。`);
        return;
      }
      if (!selectedPending) return;
      const booked = {
        studentName: selectedPending.student_name,
        courseTitle: selectedPending.course_title,
        day: selectedDay,
        startHour: startSlotDecimal(startHour, startMinute),
        startMinute,
        durationHours
      };
      // [F003][S007] Legacy paper ledger chosen from + — convert the remaining paper lessons once.
      if (scheduleCategoryId !== null) {
        await api.coachBookCategory({
          category_enrollment_id: scheduleCategoryId,
          day: selectedDay,
          start_hour: startHour,
          start_minute: startMinute,
          duration_hours: durationHours,
          coach_id: coach.id
        });
        setScheduleCategoryId(null);
        setSelectedPending(null);
        setScheduleStudentId(null);
        setScheduleSheetOpen(false);
        await reloadAll(coach.id);
        setScheduleSuccess(booked);
        return;
      }
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
      const msg = formatApiError(e, { context: "general" });
      if (/conflict|409|佔用/i.test(msg)) {
        setStatus("此時段已被佔用，請另選時間。");
      } else {
        window.alert(msg);
        setStatus(msg);
      }
    } finally {
      setScheduling(false);
    }
  }

  /** [F003][S005] Open immediately; ignore responses from closed or superseded requests. */
  async function loadStudentRecords(studentId: number, refresh = false) {
    if (!coach || (refresh && selectedStudentRef.current !== studentId)) return;
    const requestId = ++recordsRequestRef.current;
    if (!refresh) {
      studentSelectionRef.current++;
      if (selectedStudentRef.current === null && document.activeElement instanceof HTMLElement) {
        studentTriggerRef.current = document.activeElement;
      }
      selectedStudentRef.current = studentId;
      setSelectedStudentId(studentId);
      setStudentRecords(null);
      setBookingEnrollmentId(null);
      setBookingCategoryId(null);
      setBookingOriginalDate(null);
    }
    setRecordsLoading(true);
    setRecordsError("");
    try {
      const rec = (await api.coachStudentRecords(studentId, coach.id)) as CoachStudentRecordDto;
      if (recordsRequestRef.current === requestId) setStudentRecords(rec);
    } catch (e) {
      if (recordsRequestRef.current === requestId) setRecordsError(formatApiError(e, { context: "general" }));
    } finally {
      if (recordsRequestRef.current === requestId) setRecordsLoading(false);
    }
  }

  /** [F003][S005] Closing invalidates in-flight loads and restores the invoking control. */
  function closeStudentRecords() {
    recordsRequestRef.current++;
    studentSelectionRef.current++;
    selectedStudentRef.current = null;
    setSelectedStudentId(null);
    setStudentRecords(null);
    setRecordsLoading(false);
    setRecordsError("");
    setBookingEnrollmentId(null);
    setBookingCategoryId(null);
    setBookingOriginalDate(null);
    const trigger = studentTriggerRef.current;
    studentTriggerRef.current = null;
    requestAnimationFrame(() => {
      if (selectedStudentRef.current === null) trigger?.focus();
    });
  }

  /** [F003][S005] Keep keyboard focus within the sheet, unless a confirmation dialog is above it. */
  useEffect(() => {
    if (selectedStudentId === null || tab !== "students" || cancelDialog) return;
    const sheet = studentSheetRef.current;
    sheet?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeStudentRecords();
      } else if (event.key === "Tab" && sheet) {
        const controls = Array.from(sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedStudentId, tab, cancelDialog]);

  /** [F004][S002] Coach uploads a specific installment receipt (第2／第3期…) from payments tab. */
  async function uploadInstallmentReceipt(row: PaymentRow, installmentNo: number, file: File) {
    if (!coach || installmentNo < 1) return;
    if (!row.course_id && !row.installment_plan_id) return;
    const key = `${paymentRowKey(row)}-${installmentNo}`;
    setReceiptUploadBusyKey(key);
    setStatus("");
    try {
      await api.coachUploadStudentReceipt(row.student_id, {
        file,
        course_enrollment_id: row.course_id ? row.course_id : undefined,
        installment_plan_id: row.installment_plan_id ?? undefined,
        installment_no: installmentNo,
        full_payment: false,
        send_whatsapp: true,
        coach_id: coach.id
      });
      await reloadAll(coach.id);
      setStatus(`已上載第${installmentNo}期付款記錄：${row.student_name}（待 Admin 確認）`);
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setReceiptUploadBusyKey(null);
    }
  }

  async function openStudentReschedule(session: CoachSessionRow) {
    setStatus("");
    router.push("/coach-portal?tab=students");
    void loadStudentRecords(session.student_id);
    setBookingEnrollmentId(session.enrollment_id);
    setBookingOriginalDate(session.original_session_date ?? session.session_date);
    setBookDay(session.session_date);
    const [startHourValue, startMinuteValue] = session.start_time.split(":").map(Number);
    const [endHourValue, endMinuteValue] = session.end_time.split(":").map(Number);
    const duration = ((endHourValue * 60 + endMinuteValue - startHourValue * 60 - startMinuteValue) / 60) as CoachSlotDuration;
    setBookStartHour(startHourValue);
    setBookStartMinute(startMinuteValue as CoachStartMinute);
    setBookDuration(duration);
  }

  async function bookEnrollment(enrollmentId: number, confirmed: boolean) {
    if (!coach) return;
    if (isPastDay(bookDay)) {
      setStatus("不能排期到過去日期，請選今日或未來。");
      return;
    }
    const selectionId = studentSelectionRef.current;
    setBookBusy(true);
    setStatus("");
    if (slotWouldConflict([], startSlotDecimal(bookStartHour, bookStartMinute), bookDuration)) {
      setBookBusy(false);
      setStatus("排程不可超過當日 24:00，請另選。");
      return;
    }
    try {
      if (bookingOriginalDate) {
        const start = new Date(localSlotIso(bookDay, bookStartHour, bookStartMinute));
        const end = new Date(start.getTime() + bookDuration * 60 * 60 * 1000);
        await api.coachRescheduleSession(enrollmentId, bookingOriginalDate, {
          coach_id: coach.id,
          scheduled_start: localSlotIso(bookDay, bookStartHour, bookStartMinute),
          scheduled_end: localSlotIso(
            `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
            end.getHours(),
            end.getMinutes()
          )
        });
      } else {
        await api.coachBookSession({
          enrollment_id: enrollmentId,
          day: bookDay,
          start_hour: bookStartHour,
          start_minute: bookStartMinute,
          duration_hours: bookDuration,
          coach_id: coach.id
        });
      }
      await reloadAll(coach.id);
      if (studentSelectionRef.current !== selectionId || selectedStudentRef.current !== selectedStudentId || selectedStudentId === null) return;
      closeStudentRecords();
      setBookingEnrollmentId(null);
      setBookingOriginalDate(null);
      setStatus(confirmed ? "已改這一堂；其餘課堂不變。" : "已排程。");
      // [F003][S010] After booking from 學員 tab, jump back to calendar.
      router.push("/coach-portal?tab=schedule");
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

  /** [F003][S007] Convert the remaining paper lessons into a schedulable course, once. */
  async function bookCategory(categoryEnrollmentId: number) {
    if (!coach) return;
    if (isPastDay(bookDay)) {
      setStatus("不能排期到過去日期，請選今日或未來。");
      return;
    }
    const selectionId = studentSelectionRef.current;
    setBookBusy(true);
    setStatus("");
    if (slotWouldConflict([], startSlotDecimal(bookStartHour, bookStartMinute), bookDuration)) {
      setBookBusy(false);
      setStatus("排程不可超過當日 24:00，請另選。");
      return;
    }
    try {
      await api.coachBookCategory({
        category_enrollment_id: categoryEnrollmentId,
        day: bookDay,
        start_hour: bookStartHour,
        start_minute: bookStartMinute,
        duration_hours: bookDuration,
        coach_id: coach.id
      });
      await reloadAll(coach.id);
      if (studentSelectionRef.current !== selectionId) return;
      closeStudentRecords();
      setStatus("已為舊 package 排程；之後可在課程列表排下一堂。");
      router.push("/coach-portal?tab=schedule");
    } catch (e) {
      const msg = formatApiError(e, { context: "general" });
      if (/conflict|409|佔用/i.test(msg)) {
        setStatus("此時段已被佔用，請另選時間。");
      } else {
        setStatus(msg);
      }
    } finally {
      setBookBusy(false);
    }
  }

  async function confirmCancellation() {
    if (!coach || !cancelDialog) return;
    const busyKey = cancelDialog.scope === "session"
      ? `${cancelDialog.enrollmentId}:${cancelDialog.originalDate}`
      : `course:${cancelDialog.enrollmentId}`;
    setCancelBusy(busyKey);
    setStatus("");
    try {
      if (cancelDialog.scope === "session" && cancelDialog.originalDate) {
        await api.coachCancelSession(cancelDialog.enrollmentId, cancelDialog.originalDate, {
          coach_id: coach.id
        });
      } else {
        await api.coachCancelEnrollment(cancelDialog.enrollmentId, { coach_id: coach.id });
      }
      if (bookingEnrollmentId === cancelDialog.enrollmentId) {
        setBookingEnrollmentId(null);
        setBookingOriginalDate(null);
      }
      await reloadAll(coach.id);
      if (selectedStudentRef.current === cancelDialog.studentId) await loadStudentRecords(cancelDialog.studentId, true);
      setStatus(
        cancelDialog.scope === "session"
          ? "已取消這一堂；其餘課堂不變。"
          : cancelDialog.pending
            ? "已刪除待排期 package。"
            : "已取消整個課程。所有未來課堂已移除。"
      );
      setCancelDialog(null);
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setCancelBusy(null);
    }
  }

  function handleScheduleSuccessDone() {
    setScheduleSuccess(null);
    // [F003][S010] Stay on 排程 tab so calendar (auto-refreshed) stays visible.
    router.push("/coach-portal?tab=schedule");
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

  /**
   * [F004][S002]
   * Feature: Admin Reports & Financials
   * Step: Coach workbench 付款紀錄 — official receipt PDF download
   * Logic: GET receipt.pdf for a fully paid enrollment; shown only when receipt_available.
   */
  async function downloadEnrollmentReceipt(row: PaymentRow) {
    if (!row.receipt_available) return;
    setReceiptPdfBusyCourseId(row.course_id);
    setStatus("");
    try {
      await downloadBlobFile(
        `/api/coach/enrollments/${row.course_id}/receipt.pdf`,
        `receipt-course-${row.course_id}.pdf`
      );
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setReceiptPdfBusyCourseId(null);
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
    <div className="relative flex flex-col gap-4 pb-8">
      {/* Pending students stay reachable through the student picker (＋ → 待排期). */}
      <section className="order-1 flex flex-col bg-white p-1 sm:bg-surface sm:order-none sm:rounded-xl sm:border sm:border-ink/10 sm:p-4 sm:shadow-sm">
        <div className="order-2 mt-4 sm:order-none sm:mt-0">
        {/* [F008][S005] Selected-day sessions precede the calendar; changing day expands its agenda. */}
        <CoachScheduleDayAgenda
          key={selectedDay}
          selectedDay={selectedDay}
          sessions={confirmedDaySessions}
          isPastDay={isPastDay(selectedDay)}
          onReschedule={(session) => void openStudentReschedule(session)}
          onCancel={(session) =>
            setCancelDialog({
              scope: "session",
              enrollmentId: session.enrollment_id,
              studentId: session.student_id,
              studentName: session.student_name,
              courseTitle: session.course_title,
              originalDate: session.original_session_date ?? session.session_date,
              sessionLabel: `${session.session_date} · ${session.start_time}–${session.end_time}`
            })
          }
        />
        </div>
        <div className="order-1 sm:order-none">
        <h2 className="hidden text-sm font-semibold text-ink sm:block">日曆 · 學員上堂</h2>
        <p className="mt-1 hidden text-xs text-ink/55 sm:block">行程／日／3 日／週／月 · 點課堂查看詳情</p>
        <CoachScheduleCalendarNav
          selectedDay={selectedDay}
          mode={calendarMode}
          rangeSessions={rangeSessions}
          onSelectDay={handleCalendarDaySelect}
          onModeChange={setCalendarMode}
          onNavigate={handleCalendarDaySelect}
        />
        </div>

      </section>

      {scheduleSheetOpen && (selectedPending || personalBlockMode || trialDraft) ? (
        <CoachScheduleBottomSheet
          open={scheduleSheetOpen}
          studentName={
            trialDraft ? trialDraft.name : personalBlockMode ? "其他事項" : selectedPending?.student_name || ""
          }
          courseTitle={
            trialDraft
              ? trialDraft.notes || "新學生試堂"
              : personalBlockMode
                ? "私人日曆標記"
                : selectedPending?.course_title || ""
          }
          selectedDay={selectedDay}
          minDate={bookingMinDateKey()}
          dayCourses={dayCoursesForPanel}
          occupiedRanges={[]}
          startHour={startHour}
          startMinute={startMinute}
          durationHours={durationHours}
          scheduling={scheduling}
          confirmLabel={trialDraft ? "加入試堂" : personalBlockMode ? "加入其他事項" : "確認排程"}
          onClose={() => {
            setScheduleSheetOpen(false);
            setPersonalBlockMode(false);
            setTrialDraft(null);
            setScheduleCategoryId(null);
          }}
          onDayChange={setSelectedDay}
          onStartTimeChange={(h, m) => {
            setStartHour(h);
            setStartMinute(m);
          }}
          onDurationChange={setDurationHours}
          onConfirm={() => void confirmSchedule()}
          onChangeSelection={openChangeSelection}
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
        onPickPersonal={handlePickPersonal}
        onPickTrial={handlePickTrial}
      />

      <CoachSchedulePackagePickerSheet
        open={packagePick != null}
        studentName={packagePick?.studentName ?? ""}
        packages={packagePick?.packages ?? []}
        onClose={() => setPackagePick(null)}
        onPick={handlePickPackage}
      />

      <CoachScheduleFab onClick={handleFabClick} disabled={isPastDay(selectedDay)} />
    </div>
  );

  function installmentUploadControl(row: PaymentRow) {
    if (!row.course_id && !row.installment_plan_id) return null;
    const pending = row.pending_installment_nos ?? [];
    const allUnpaid =
      row.unpaid_installment_nos && row.unpaid_installment_nos.length > 0
        ? row.unpaid_installment_nos
        : row.next_installment_no
          ? [row.next_installment_no]
          : [];
    const nos = allUnpaid.filter((n) => !pending.includes(n));
    // [F004][S002] Show 第2／第3期 buttons; uploaded proofs wait for Admin confirmation.
    if (nos.length === 0 && pending.length === 0) return null;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {pending.map((n) => (
          <span
            key={`${paymentRowKey(row)}-pending-${n}`}
            className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900"
          >
            第 {n} 期待 Admin 確認
          </span>
        ))}
        {nos.map((n) => {
          const key = `${paymentRowKey(row)}-${n}`;
          const busy = receiptUploadBusyKey === key;
          return (
            <label
              key={key}
              className="inline-flex cursor-pointer items-center rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-black hover:bg-primary/20"
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                disabled={busy || receiptUploadBusyKey != null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadInstallmentReceipt(row, n, file);
                }}
              />
              {busy ? "上載中…" : `上載第 ${n} 期付款記錄`}
            </label>
          );
        })}
      </div>
    );
  }

  const paymentsPanel = (
    <div className="space-y-4 md:hidden">
      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">付款紀錄</h2>
        <p className="mt-1 text-xs text-ink/55">待付款及已收款項；可搜索學員或課程。</p>
        {payments.length > 0 ? (
          <label className="mt-3 block text-sm">
            <span className="sr-only">搜索付款紀錄</span>
            <input
              type="search"
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="搜索學員姓名、電話或課程"
              className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink/40"
            />
          </label>
        ) : null}
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">待跟進</h3>
        {filteredUnpaidPayments.length === 0 ? (
          <p className="mt-2 rounded-xl border border-ink/10 bg-surface px-4 py-4 text-center text-sm text-ink/50">
            {paymentSearch ? `找不到符合「${paymentSearch}」的待付款記錄。` : "暫無待付款／缺收據記錄。"}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {filteredUnpaidPayments.map((row) => (
              <article key={`unpaid-${paymentRowKey(row)}`} className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                <div className="font-medium text-ink">{row.student_name}</div>
                <div className="text-xs text-ink/50">{row.student_phone}</div>
                <div className="mt-2 text-sm text-ink/80">{row.course_title}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 font-medium text-amber-950">Pending</span>
                  <span className="text-ink/70">{row.installment_status}</span>
                </div>
                {installmentUploadControl(row)}
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">付款紀錄</h3>
        {filteredPaidPayments.length === 0 ? (
          <p className="mt-2 rounded-xl border border-ink/10 bg-surface px-4 py-4 text-center text-sm text-ink/50">
            {paymentSearch ? `找不到符合「${paymentSearch}」的付款記錄。` : "暫無付款紀錄。"}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {filteredPaidPayments.map((row) => (
              <article key={`paid-${paymentRowKey(row)}`} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
                <div className="font-medium text-ink">{row.student_name}</div>
                <div className="text-xs text-ink/50">{row.student_phone}</div>
                <div className="mt-2 text-sm text-ink/80">{row.course_title}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">Paid</span>
                  <span className="text-ink/70">{row.installment_status}</span>
                </div>
                {row.receipt_available ? (
                  <button
                    type="button"
                    disabled={receiptPdfBusyCourseId === row.course_id}
                    onClick={() => void downloadEnrollmentReceipt(row)}
                    className="mt-3 rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
                  >
                    {receiptPdfBusyCourseId === row.course_id ? "產生中…" : "收據 PDF"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const paymentsPanelDesktop = (
    <div className="hidden space-y-4 md:block">
      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">付款紀錄</h2>
        <p className="mt-1 text-xs text-ink/55">待付款及已收款項；可搜索學員或課程。</p>
        {payments.length > 0 ? (
          <label className="mt-3 block text-sm">
            <span className="sr-only">搜索付款紀錄</span>
            <input
              type="search"
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="搜索學員姓名、電話或課程"
              className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink/40"
            />
          </label>
        ) : null}
      </section>
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
                <th className="px-2 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnpaidPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-ink/50">
                    {paymentSearch ? `找不到符合「${paymentSearch}」的待付款記錄。` : "暫無待付款／缺收據記錄。"}
                  </td>
                </tr>
              ) : (
                filteredUnpaidPayments.map((row) => (
                  <tr key={`unpaid-${paymentRowKey(row)}`} className="border-b border-ink/[0.06]">
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-ink">{row.student_name}</div>
                      <div className="text-xs text-ink/50">{row.student_phone}</div>
                    </td>
                    <td className="px-2 py-2.5 text-ink/80">{row.course_title}</td>
                    <td className="px-2 py-2.5">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Pending</span>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-ink/70">{row.installment_status}</td>
                    <td className="px-2 py-2.5">{installmentUploadControl(row)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">付款紀錄</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs text-ink/55">
                <th className="px-2 py-2 font-medium">學員</th>
                <th className="px-2 py-2 font-medium">課程</th>
                <th className="px-2 py-2 font-medium">付款</th>
                <th className="px-2 py-2 font-medium">分期</th>
                <th className="px-2 py-2 font-medium">收據</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaidPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-ink/50">
                    {paymentSearch ? `找不到符合「${paymentSearch}」的付款記錄。` : "暫無付款紀錄。"}
                  </td>
                </tr>
              ) : (
                filteredPaidPayments.map((row) => (
                  <tr key={`paid-${paymentRowKey(row)}`} className="border-b border-ink/[0.06]">
                    <td className="px-2 py-2.5">
                      <div className="font-medium text-ink">{row.student_name}</div>
                      <div className="text-xs text-ink/50">{row.student_phone}</div>
                    </td>
                    <td className="px-2 py-2.5 text-ink/80">{row.course_title}</td>
                    <td className="px-2 py-2.5">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Paid</span>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-ink/70">{row.installment_status}</td>
                    <td className="px-2 py-2.5">
                      {row.receipt_available ? (
                        <button
                          type="button"
                          disabled={receiptPdfBusyCourseId === row.course_id}
                          onClick={() => void downloadEnrollmentReceipt(row)}
                          className="rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
                        >
                          {receiptPdfBusyCourseId === row.course_id ? "產生中…" : "收據 PDF"}
                        </button>
                      ) : (
                        <span className="text-xs text-ink/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const selectedStudent = students.find((student) => student.student_id === selectedStudentId);

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
        {students.length > 0 ? (
          <label className="mt-3 block text-sm">
            <span className="sr-only">搜索學員</span>
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="搜索學員姓名或電話"
              className="w-full rounded-lg border border-ink/10 bg-canvas px-3 py-2.5 text-sm text-ink placeholder:text-ink/40"
            />
          </label>
        ) : null}
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">暫無指派學員。</p>
        ) : filteredStudents.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">找不到符合「{studentSearch}」的學員。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {filteredStudents.map((s) => (
              <li
                key={s.student_id}
                className={`overflow-hidden rounded-lg border transition ${
                  selectedStudentId === s.student_id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-ink/10 bg-canvas"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void loadStudentRecords(s.student_id)}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-primary/5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-medium text-ink">{s.full_name}</span>
                    <span className="text-xs tabular-nums text-ink/60">{s.phone}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink/60">
                    餘 {s.lesson_balance} 堂 · {s.enrollment_count} 個 package
                    {s.pending_schedule ? " · 待排程" : ""}
                  </div>
                  {(s.category_packages?.length ?? 0) > 0 ? (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink/55">
                      {s.category_packages!.map((c) => (
                        <span key={c.id}>
                          {c.category_name}（舊 package）：已上 {c.lessons_already_taken} · 剩 {c.remaining_from_paper}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* [F003][S005] Student details remain at the current viewport position on long rosters. */}
      <CoachBottomSheet open={selectedStudentId !== null} onClose={closeStudentRecords} ariaLabelledBy="coach-student-details-title" heightClass="h-[85dvh] max-h-[85dvh]">
        <div ref={studentSheetRef} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink/10 px-4 pb-3">
            <h2 id="coach-student-details-title" className="text-sm font-semibold text-ink">
              學員詳情{selectedStudent ? ` · ${selectedStudent.full_name}` : studentRecords ? ` · ${studentRecords.full_name}` : ""}
            </h2>
            <button type="button" onClick={closeStudentRecords} aria-label="關閉學員詳情" className="rounded-lg border border-ink/15 px-3 py-2 text-xs font-medium text-ink hover:bg-ink/5">關閉</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {selectedStudent?.packages?.length ? (
              <section className="mb-4" aria-label="Package 進度">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Package 進度</h3>
                <ul className="mt-2 divide-y divide-ink/[0.06] rounded-lg border border-ink/10 bg-canvas">
                  {selectedStudent.packages.map((p) => {
                    const paper = p.legacy_prior_lessons ?? 0;
                    return (
                    <li key={p.enrollment_id} className="px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="font-medium text-ink">
                          {p.branch_code ? <span className="mr-1.5 rounded bg-ink/8 px-1 py-0.5 text-[10px] font-semibold uppercase text-ink/70">{p.branch_code}</span> : null}
                          {p.course_title}
                        </span>
                        <span className="text-ink/60">{p.branch_name ?? "—"}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-ink/60">
                        <span>總 {p.total_lessons + paper} 堂</span>
                        <span>已上 {p.used_lessons + paper} 堂</span>
                        <span className={p.remaining_lessons > 0 ? "font-medium text-emerald-700" : "text-ink/45"}>剩 {p.remaining_lessons} 堂</span>
                        {!p.coach_time_confirmed ? <span className="font-medium text-amber-700">待排程</span> : null}
                        {p.payment_status && p.payment_status !== "Paid" ? <span className="text-amber-700">{p.installment_status || p.payment_status}</span> : null}
                      </div>
                      {(p.installment_periods?.length ?? 0) > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-ink/55">
                          <span className="font-medium text-ink/45">分期扣堂：</span>
                          {p.installment_periods!.map((per) => <span key={per.installment_no}>第{per.installment_no}期 第{per.lesson_from}–{per.lesson_to}堂{per.paid ? "（已付）" : "（未付）"}</span>)}
                        </div>
                      ) : null}
                    </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {recordsLoading ? <p role="status" className="mb-4 text-sm text-ink/50">載入學員記錄…</p> : null}
            {recordsError ? (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p>未能載入學員記錄：{recordsError}</p>
                <button type="button" onClick={() => selectedStudentId !== null && void loadStudentRecords(selectedStudentId, true)} className="mt-2 underline">重試</button>
              </div>
            ) : null}
            {studentRecords ? (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">
              {studentRecords.full_name} · 餘 {studentRecords.lesson_balance} 堂
            </h3>
            <Link
              href={`/coach-portal/reg-course?student=${encodeURIComponent(studentRecords.phone)}`}
              className="rounded-lg bg-primary/90 px-3 py-2 text-xs font-semibold text-black"
            >
              報 Course · 填堂數／付款
            </Link>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/50">個人資料</h4>
            <p className="mt-2 text-xs text-ink/70">
              出生日期：{studentRecords.date_of_birth ?? "—"}
              <span className="mx-1.5 text-ink/30">·</span>
              緊急聯絡：
              {studentRecords.emergency_contact_name
                ? `${studentRecords.emergency_contact_name}${
                    studentRecords.emergency_contact_relationship
                      ? `（${studentRecords.emergency_contact_relationship}）`
                      : ""
                  }${studentRecords.emergency_contact_phone ? ` ${studentRecords.emergency_contact_phone}` : ""}`
                : "—"}
            </p>
          </div>

          {/* [F003][S005] Category ledger imports are separate from scheduled courses. */}
          {(studentRecords.category_enrollments?.length ?? 0) > 0 ? (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/50">種類帳面</h4>
              <ul className="mt-2 space-y-2">
                {studentRecords.category_enrollments!.map((row) => {
                  const hasPinShell = (studentRecords.enrollments ?? []).some(
                    (e) => e.legacy_category_enrollment_id === row.id
                  );
                  return (
                  <li key={row.id} className="rounded-lg border border-ink/10 bg-canvas p-3 text-xs text-ink/70">
                    <p className="font-medium text-ink">{row.category_name} · 總 {row.total_lessons} 堂</p>
                    <p className="mt-1">已上 {row.lessons_already_taken} 堂 · 剩 {row.remaining_from_paper} 堂</p>
                    {row.scheduled_enrollment_id != null ? (
                      <p className="mt-2 text-emerald-800">已排程為 Course（見下方課程）；請在課程按「排下一堂」。</p>
                    ) : hasPinShell ? (
                      <p className="mt-2 text-ink/55">
                        已有課堂 PIN（見上方 Package 進度）；請用該 package 排程，唔使再排舊帳面。
                      </p>
                    ) : row.scheduled_once ? (
                      <p className="mt-2 text-ink/55">已排程過而課程已刪除；如需重排，請聯絡 Admin。</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setStatus("");
                          setBookingEnrollmentId(null);
                          setBookingCategoryId(row.id);
                          setBookDay(bookingMinDateKey());
                          setBookStartHour(9);
                          setBookStartMinute(0);
                          setBookDuration(1);
                        }}
                        className="mt-2 min-h-11 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-black"
                      >
                        排這個舊 package（{row.remaining_from_paper} 堂）
                      </button>
                    )}
                    {bookingCategoryId === row.id ? (
                      <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
                        <div>
                          <p className="mb-1 text-xs text-ink/70">日期</p>
                          <CoachDateStepper value={bookDay} onChange={setBookDay} minDate={bookingMinDateKey()} />
                        </div>
                        <CoachStartTimeSelect
                          startHour={bookStartHour}
                          startMinute={bookStartMinute}
                          durationHours={bookDuration}
                          occupiedRanges={[]}
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
                          name={`book-category-duration-${row.id}`}
                          startHour={startSlotDecimal(bookStartHour, bookStartMinute)}
                          durationHours={bookDuration}
                          occupiedRanges={[]}
                          onChange={setBookDuration}
                        />
                        {status ? <p role="alert" className="text-xs text-red-700">{status}</p> : null}
                        <button
                          type="button"
                          disabled={
                            bookBusy ||
                            slotWouldConflict([], startSlotDecimal(bookStartHour, bookStartMinute), bookDuration)
                          }
                          onClick={() => void bookCategory(row.id)}
                          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-black disabled:opacity-50 sm:w-auto"
                        >
                          {bookBusy ? "…" : "確認排程"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-xs text-ink/55">未包括其他簽到或扣堂；最新可扣堂餘額見上方。</p>
              <p className="mt-1 text-xs text-ink/55">排程只建立剩餘 package 堂數的 Course；已上／剩會與帳面同步。</p>
            </div>
          ) : null}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/50">課程 / 分期</h4>
            {studentRecords.enrollments.length === 0 ? (
              <p className="mt-2 text-xs text-ink/55">
                {(studentRecords.category_enrollments?.length ?? 0) > 0
                  ? "暫無可排程的 Course。"
                  : "尚未報 Course。按上方「報 Course · 填堂數／付款」選擇 package、堂數與付款方式。"}
              </p>
            ) : null}
            <ul className="mt-2 space-y-3">
              {studentRecords.enrollments.map((enr) => (
                <li key={enr.enrollment_id} className="rounded-lg border border-ink/10 bg-canvas p-3 text-sm">
                  <div className="font-medium text-ink">{enr.course_title}</div>
                  <div className="mt-1 text-xs text-ink/60">
                    {enr.coach_time_confirmed
                      ? `${new Date(enr.scheduled_start).toLocaleString("zh-HK")} · ${enr.total_lessons} 堂可排`
                      : "待排程"}
                    {" · "}
                    {enr.installment_status} ({enr.payment_status})
                  </div>
                  {(enr.installment_periods?.length ?? 0) > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-ink/55">
                      <span className="font-medium text-ink/45">分期扣堂：</span>
                      {enr.installment_periods!.map((per) => (
                        <span key={per.installment_no}>
                          第{per.installment_no}期 第{per.lesson_from}–{per.lesson_to}堂
                          {per.paid ? "（已付）" : "（未付）"}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
                        setStatus("");
                        setBookingCategoryId(null);
                        setBookingEnrollmentId(enr.enrollment_id);
                        setBookingOriginalDate(null);
                        setBookDay(bookingMinDateKey());
                        setBookStartHour(9);
                        setBookStartMinute(0);
                        setBookDuration(1);
                      }}
                      className="min-h-11 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-black"
                    >
                      {enr.coach_time_confirmed ? "排下一堂" : "排程 0.5–2h"}
                    </button>
                    {/* [F003][S009] Q4.1 — coach may delete a package from their roster. */}
                    <button
                      type="button"
                      onClick={() =>
                        setCancelDialog({
                          scope: "course",
                          enrollmentId: enr.enrollment_id,
                          studentId: studentRecords.student_id,
                          studentName: studentRecords.full_name,
                          courseTitle: enr.course_title,
                          pending: !enr.coach_time_confirmed
                        })
                      }
                      className="min-h-11 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100"
                    >
                      刪除 package
                    </button>
                  </div>
                  {bookingEnrollmentId === enr.enrollment_id ? (
                    <div className="mt-3 space-y-3 border-t border-ink/10 pt-3">
                      <div>
                        <p className="mb-1 text-xs text-ink/70">日期</p>
                        <CoachDateStepper value={bookDay} onChange={setBookDay} minDate={bookingMinDateKey()} />
                      </div>
                      <CoachStartTimeSelect
                        startHour={bookStartHour}
                        startMinute={bookStartMinute}
                        durationHours={bookDuration}
                        occupiedRanges={[]}
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
                        occupiedRanges={[]}
                        onChange={setBookDuration}
                      />
                      {status ? <p role="alert" className="text-xs text-red-700">{status}</p> : null}
                      <button
                        type="button"
                        disabled={
                          bookBusy ||
                          slotWouldConflict([], startSlotDecimal(bookStartHour, bookStartMinute), bookDuration)
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
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/50">收據／上傳檔案</h4>
            {(studentRecords.receipts ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-ink/45">暫無上傳檔案。</p>
            ) : (
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {(studentRecords.receipts ?? []).map((r) => {
                  const abs = apiAssetUrl(r.file_url) ?? "#";
                  return (
                    <li key={r.id} className="rounded-lg border border-ink/10 bg-canvas p-3 text-xs">
                      <div className="font-medium text-ink">
                        {r.source} · {r.payment_method ?? "付款方式未填"}
                      </div>
                      <div className="mt-0.5 text-ink/55 tabular-nums">
                        {r.amount != null ? `HKD ${r.amount}` : "金額 —"} · {formatHktDateTime(r.created_at)}
                      </div>
                      {r.note ? <p className="mt-1 text-ink/60">{r.note}</p> : null}
                      <CoachReceiptPreview fileUrl={abs} label={`receipt-${r.id}`} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/50">上堂記錄（簽到）</h4>
            {studentRecords.attendance.length === 0 && studentRecords.checkins.length === 0 ? (
              <p className="mt-2 text-xs text-ink/45">暫無上堂記錄。</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-ink/75">
                {studentRecords.attendance.map((a) => (
                  <li key={`att-${a.id}`}>
                    {a.session_calendar_date} · {a.course_title ?? "課堂"} · {formatHktDateTime(a.attended_at)}
                  </li>
                ))}
                {studentRecords.checkins.map((c) => (
                  <li key={`chk-${c.id}`}>
                    {/* [F003][S001] Hide machine channel codes (qr_pin) from staff UI */}
                    {formatHktDateTime(c.created_at)} · 簽到成功
                    {c.remarks ? ` · ${c.remarks}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
            ) : null}
          </div>
        </div>
      </CoachBottomSheet>
    </div>
  );

  return (
    <>
      {/* [F008][S005] Desktop schedule needs a full-width week; other coach tabs retain compact forms. */}
      <div className={`mx-auto px-3 py-4 md:px-4 ${tab === "schedule" ? "max-w-7xl" : "max-w-lg md:max-w-2xl"}`}>
        {paymentUrgent.length > 0 ? (
          <details className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 sm:hidden">
            <summary className="cursor-pointer font-semibold">付款提醒 · {paymentUrgent.length} 位學員待跟進</summary>
            <div className="flex gap-4 py-3"><Link href="/coach-portal?tab=payments" className="underline">付款紀錄</Link><Link href="/coach-portal?tab=students" className="underline">學員 · WhatsApp 催款</Link></div>
          </details>
        ) : null}
        {paymentUrgent.length > 0 ? (
          <section className="mb-4 hidden rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm sm:block">
            <p className="font-semibold">付款提醒 · {paymentUrgent.length} 位學員待跟進</p>
            <p className="mt-1 text-xs text-amber-900/85">
              請主動聯絡以下學員安排付款：
              {" "}
              {paymentUrgent.slice(0, 4).map((p) => p.student_name).join("、")}
              {paymentUrgent.length > 4 ? ` 等 ${paymentUrgent.length} 人` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <Link href="/coach-portal?tab=payments" className="text-amber-900 underline">
                前往付款紀錄 →
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
        onDone={handleScheduleSuccessDone}
      />
      <CoachCancelConfirmDialog
        open={cancelDialog != null}
        scope={cancelDialog?.scope ?? "session"}
        studentName={cancelDialog?.studentName ?? ""}
        courseTitle={cancelDialog?.courseTitle ?? ""}
        sessionLabel={cancelDialog?.sessionLabel}
        pending={cancelDialog?.pending}
        busy={cancelBusy != null}
        onClose={() => setCancelDialog(null)}
        onConfirm={() => void confirmCancellation()}
      />
    </>
  );
}
