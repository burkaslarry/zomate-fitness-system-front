"use client";

/**
 * [F003][S001]
 * Feature: Coach Dashboard
 * Step: Auth gate, pending queue, hourly calendar (9–19), payments, signature update
 * Logic: COACH-only; scheduling via enrollment.coach_time_confirmed; strict slot blocking.
 */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import BackendShell from "../../components/backend-shell";
import { alertApiError, api, apiAssetUrl } from "../../lib/api";
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

type Tab = "schedule" | "students" | "payments" | "signature";

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

/** [F003][S004] Canvas stroke signature as PNG data URL (production-visible handwriting). */
function randomSignatureDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 140;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "data:image/png;base64,iVBORw0KGgo=";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let x = 24 + Math.random() * 20;
  let y = 70 + Math.random() * 24;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i < 10; i++) {
    x += 18 + Math.random() * 36;
    y = 45 + Math.random() * 50;
    ctx.quadraticCurveTo(x - 12, y + (Math.random() - 0.5) * 30, x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(40 + Math.random() * 30, 95 + Math.random() * 15);
  ctx.lineTo(canvas.width - 40, 90 + Math.random() * 20);
  ctx.stroke();
  return canvas.toDataURL("image/png");
}

function occupiedHoursForDay(courses: CourseRow[], day: string, pendingCourseIds: Set<number>): Set<number> {
  const occupied = new Set<number>();
  for (const c of courses) {
    if (pendingCourseIds.has(c.id)) continue;
    if (localDateKey(c.scheduled_start) !== day) continue;
    const startH = new Date(c.scheduled_start).getHours();
    let endH = new Date(c.scheduled_end).getHours();
    if (endH <= startH) endH = startH + 1;
    for (let h = startH; h < endH; h++) occupied.add(h);
  }
  return occupied;
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
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [sigBusy, setSigBusy] = useState(false);
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
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);

  const pendingCourseIds = useMemo(() => new Set(pending.map((p) => p.course_id)), [pending]);
  const occupied = useMemo(
    () => occupiedHoursForDay(dayCourses, selectedDay, pendingCourseIds),
    [dayCourses, selectedDay, pendingCourseIds]
  );

  const mingStudent = useMemo(
    () => payments.find((p) => /ming/i.test(p.student_name)) ?? null,
    [payments]
  );

  const paymentUrgent = useMemo(() => {
    return payments.filter((p) => p.payment_status === "Pending" || p.payment_status === "Overdue");
  }, [payments]);

  const bookOccupiedForStudent = useMemo(
    () => occupiedHoursForDay(dayCourses, bookDay, pendingCourseIds),
    [dayCourses, bookDay, pendingCourseIds]
  );

  const reloadCoachSchedule = useCallback(async (coachId: number) => {
    const [pList, cList] = await Promise.all([
      api.coachPendingStudents(coachId) as Promise<PendingRow[]>,
      api.coachSchedule(coachId, selectedDay) as Promise<CourseRow[]>
    ]);
    setPending(pList ?? []);
    setDayCourses(cList ?? []);
  }, [selectedDay]);

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

  useEffect(() => {
    if (!selectedPending) return;
    setStartHour(9);
    setDurationHours(1);
  }, [selectedPending]);

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
      console.log("[Demo Track] Schedule Confirmed → Local Coach Calendar Hydrating", {
        coach_id: coach.id,
        day: selectedDay
      });
      await reloadCoachSchedule(coach.id);
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
      console.log("[Demo Track] Student Records Loaded", { student_id: studentId, checkins: rec.checkins.length });
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setRecordsLoading(false);
    }
  }

  async function bookEnrollment(enrollmentId: number, confirmed: boolean) {
    if (!coach) return;
    const bookOccupied = occupiedHoursForDay(dayCourses, bookDay, pendingCourseIds);
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
      console.log("[Demo Track] Coach Booking Confirmed", {
        enrollment_id: enrollmentId,
        confirmed,
        day: bookDay
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
      console.log("[Demo Track] WhatsApp Payment Reminder Logged", { student_id: studentId, course_id: courseId });
      window.open(res.wa_link, "_blank", "noopener,noreferrer");
      setStatus("已記錄 WhatsApp 催款訊息，並開啟 WhatsApp。");
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setRemindBusy(null);
    }
  }

  async function uploadReceiptForCourse(
    ev: FormEvent<HTMLFormElement>,
    target: {
      student_id: number;
      course_id: number;
      course_title: string;
      next_installment_no?: number | null;
    }
  ) {
    ev.preventDefault();
    if (!coach) return;
    const form = ev.currentTarget;
    const data = new FormData(form);
    const file = data.get("receipt");
    if (!(file instanceof File) || !file.name) {
      setStatus("請先選擇 receipt 檔案。");
      return;
    }
    const kind = String(data.get("payment_kind") || "full");
    const installmentRaw = Number(data.get("installment_no") || target.next_installment_no || 1);
    const busyKey = `${target.student_id}-${target.course_id}`;
    setReceiptBusy(busyKey);
    setStatus("");
    try {
      await api.coachUploadStudentReceipt(target.student_id, {
        file,
        amount: String(data.get("amount") || "").trim() || undefined,
        payment_method: String(data.get("payment_method") || "").trim() || undefined,
        note: String(data.get("note") || "").trim() || `Coach upload · ${target.course_title}`,
        course_enrollment_id: target.course_id > 0 ? target.course_id : undefined,
        installment_no: kind === "installment" ? installmentRaw : undefined,
        full_payment: kind === "full",
        send_whatsapp: true,
        coach_id: coach.id
      });
      form.reset();
      await reloadAll(coach.id);
      if (selectedStudentId) await loadStudentRecords(selectedStudentId);
      setStatus("已上傳 receipt；如屬分期或 full payment，系統已同步付款狀態並記錄 WhatsApp。");
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setReceiptBusy(null);
    }
  }

  function receiptUploadForm(target: {
    student_id: number;
    course_id: number;
    course_title: string;
    next_installment_no?: number | null;
    next_reminder_lesson?: number | null;
  }) {
    const key = `${target.student_id}-${target.course_id}`;
    const hasCourse = target.course_id > 0;
    const nextInstallment = target.next_installment_no ?? 2;
    return (
      <form
        onSubmit={(ev) => void uploadReceiptForCourse(ev, target)}
        className="mt-2 grid gap-1.5 rounded-lg border border-ink/10 bg-canvas p-2 text-xs sm:grid-cols-[minmax(8rem,1fr)_auto_auto]"
      >
        <input
          name="receipt"
          type="file"
          required
          accept="image/*,.pdf"
          className="rounded border border-ink/10 bg-surface px-2 py-1 text-ink file:mr-2 file:rounded file:border-0 file:bg-primary/15 file:px-2 file:py-1 file:text-xs file:font-medium"
        />
        <select
          name="payment_kind"
          defaultValue={hasCourse && target.next_installment_no ? "installment" : "full"}
          className="rounded border border-ink/10 bg-surface px-2 py-1 text-ink"
        >
          <option value="full">Full payment</option>
          {hasCourse ? <option value="installment">Instalment</option> : null}
        </select>
        <select
          name="installment_no"
          defaultValue={String(nextInstallment)}
          disabled={!hasCourse}
          className="rounded border border-ink/10 bg-surface px-2 py-1 text-ink disabled:opacity-45"
        >
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}期
            </option>
          ))}
        </select>
        <input
          name="amount"
          inputMode="decimal"
          placeholder="HKD 金額"
          className="rounded border border-ink/10 bg-surface px-2 py-1 text-ink"
        />
        <input
          name="payment_method"
          placeholder="FPS / cash / bank"
          className="rounded border border-ink/10 bg-surface px-2 py-1 text-ink"
        />
        <button
          type="submit"
          disabled={receiptBusy === key}
          className="rounded border border-primary/40 bg-primary/10 px-2 py-1 font-semibold text-ink disabled:opacity-50"
        >
          {receiptBusy === key ? "上傳中…" : "上傳 receipt"}
        </button>
        {target.next_reminder_lesson ? (
          <p className="sm:col-span-3 text-[11px] text-ink/55">
            預設第 {target.next_reminder_lesson} 堂 reminder；receipt 對應期數後會開通該期 PIN。
          </p>
        ) : null}
      </form>
    );
  }

  async function updateMingSignature() {
    if (!mingStudent) {
      setStatus("找不到學員 Ming。");
      return;
    }
    const dataUrl = randomSignatureDataUrl();
    setSigPreview(dataUrl);
    setSigBusy(true);
    try {
      const res = (await api.coachUpdateSignature(mingStudent.student_id, dataUrl)) as {
        signature_image_url?: string;
      };
      setSigPreview(apiAssetUrl(res.signature_image_url) ?? dataUrl);
      if (coach) await reloadAll(coach.id);
      setStatus("已更新 Ming 簽名。");
    } catch (e) {
      alertApiError(e);
      setStatus(String(e));
    } finally {
      setSigBusy(false);
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
        <h2 className="text-sm font-semibold text-ink">待排程學員</h2>
        <p className="mt-1 text-xs text-ink/55">
          {pending.length > 0
            ? `你有 ${pending.length} 位學生未約第一堂時間`
            : "Admin 已指派給你、尚未確認上課時間的學員。"}
        </p>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">目前沒有待排程學員。</p>
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
        {!selectedPending ? (
          <p className="mt-3 text-sm text-ink/50">請先從上方揀一位待排程學員，再點選時段。</p>
        ) : (
          <p className="mt-2 text-xs text-ink/65">
            正在為 <strong>{selectedPending.student_name}</strong> 排程 · 時段 1–2 小時
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {HOURS.map((h) => {
            const blocked = occupied.has(h);
            const can1 = !slotWouldConflict(occupied, h, 1);
            const can2 = !slotWouldConflict(occupied, h, 2);
            const disabled = !selectedPending || (!can1 && !can2);
            return (
              <button
                key={h}
                type="button"
                disabled={disabled || (blocked && !can1 && !can2)}
                onClick={() => {
                  if (!selectedPending) return;
                  setStartHour(h);
                  setDurationHours(can1 ? 1 : 2);
                }}
                className={`rounded-lg border px-2 py-3 text-center text-xs font-medium transition ${
                  blocked
                    ? "cursor-not-allowed border-ink/10 bg-ink/5 text-ink/35 line-through"
                    : startHour === h && selectedPending
                      ? "border-primary bg-primary/15 text-ink"
                      : disabled
                        ? "border-ink/10 bg-canvas text-ink/40"
                        : "border-ink/15 bg-canvas text-ink hover:border-primary/50"
                }`}
              >
                {pad2(h)}:00
                {blocked ? " 已佔" : ""}
              </button>
            );
          })}
        </div>
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
                <li key={c.id}>
                  {new Date(c.scheduled_start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  {" — "}
                  {c.title}
                  {c.enrollments.map((e) => e.student_name).join("、")}
                </li>
              ))}
          </ul>
        ) : null}
      </section>
    </div>
  );

  const paymentsPanel = (
    <div className="overflow-x-auto pb-24">
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
          {payments.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-2 py-6 text-center text-ink/50">
                暫無學員收款資料。
              </td>
            </tr>
          ) : (
            payments.map((row) => {
              const needsRemind = row.payment_status === "Pending" || row.payment_status === "Overdue";
              return (
                <tr key={`${row.student_id}-${row.course_id}`} className="border-b border-ink/[0.06]">
                  <td className="px-2 py-2.5">
                    <div className="font-medium text-ink">{row.student_name}</div>
                    <div className="text-xs text-ink/50">{row.student_phone}</div>
                  </td>
                  <td className="px-2 py-2.5 text-ink/80">{row.course_title}</td>
                  <td className="px-2 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.payment_status === "Paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : row.payment_status === "Overdue"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {row.payment_status}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-ink/70">{row.installment_status}</td>
                  <td className="px-2 py-2.5">
                    {needsRemind ? (
                      <button
                        type="button"
                        disabled={remindBusy === row.course_id}
                        onClick={() => void sendPaymentReminder(row.student_id, row.course_id)}
                        className="inline-block rounded-lg border border-emerald-600/40 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {remindBusy === row.course_id ? "…" : "WhatsApp 催款"}
                      </button>
                    ) : (
                      <span className="text-xs text-ink/40">—</span>
                    )}
                    {receiptUploadForm({
                      student_id: row.student_id,
                      course_id: row.course_id,
                      course_title: row.course_title,
                      next_installment_no: row.next_installment_no,
                      next_reminder_lesson: row.next_reminder_lesson
                    })}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const studentsPanel = (
    <div className="space-y-4 pb-24">
      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">我的學員</h2>
        <p className="mt-1 text-xs text-ink/55">查閱上堂記錄、分期催款、代排 1–2 小時時段。</p>
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
                  {receiptUploadForm({
                    student_id: studentRecords.student_id,
                    course_id: enr.enrollment_id,
                    course_title: enr.course_title,
                    next_installment_no: enr.next_installment_no,
                    next_reminder_lesson: enr.next_reminder_lesson
                  })}
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

  const signaturePanel = (
    <div className="space-y-4 pb-24">
      <section className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">學員簽名更新</h2>
        <p className="mt-1 text-xs text-ink/55">測試：為 Ming 產生新手寫簽名並寫入資料庫。</p>
        {mingStudent ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink">
              目標學員：<strong>{mingStudent.student_name}</strong>（#{mingStudent.student_id}）
            </p>
            <button
              type="button"
              disabled={sigBusy}
              onClick={() => void updateMingSignature()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sigBusy ? "更新中…" : "更新 Ming 簽名（隨機筆跡）"}
            </button>
            {(sigPreview || mingStudent.signature_image_url) && (
              <div className="rounded-lg border border-ink/10 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sigPreview ?? apiAssetUrl(mingStudent.signature_image_url) ?? ""}
                  alt="簽名預覽"
                  className="max-h-36 w-full object-contain"
                />
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/50">找不到名稱含 Ming 的指派學員。</p>
        )}
      </section>
      <p className="text-center text-[11px] text-ink/45">
        <Link href="/coach/calendar" className="text-primary underline-offset-2 hover:underline">
          教練日程 · 簽到
        </Link>
      </p>
    </div>
  );

  return (
    <BackendShell title={`教練 · ${coach.full_name}`} layout="coach">
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
            <button
              type="button"
              onClick={() => setTab("payments")}
              className="mt-2 text-xs font-semibold text-amber-900 underline"
            >
              前往收款分頁催款 →
            </button>
          </section>
        ) : null}
        {status ? (
          <p className="mb-3 rounded-lg border border-ink/10 bg-surface px-3 py-2 text-xs text-ink/70">{status}</p>
        ) : null}

        {tab === "schedule" ? schedulePanel : null}
        {tab === "students" ? studentsPanel : null}
        {tab === "payments" ? paymentsPanel : null}
        {tab === "signature" ? signaturePanel : null}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] border-t border-ink/15 bg-surface/98 pb-[env(safe-area-inset-bottom,0)] shadow-[0_-6px_24px_rgba(45,36,34,0.08)] backdrop-blur-md md:mx-auto md:max-w-lg"
        aria-label="教練主選單"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 p-2">
          {(
            [
              { id: "schedule" as Tab, label: "排程", icon: "▣" },
              { id: "students" as Tab, label: "學員", icon: "👤" },
              { id: "payments" as Tab, label: "收款", icon: "◎" },
              { id: "signature" as Tab, label: "簽名", icon: "✎" }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold sm:text-[12px] ${
                tab === item.id
                  ? "!border-transparent !bg-zinc-800 !text-white shadow-md"
                  : "!border-transparent !bg-transparent !text-zinc-700 hover:!bg-black/[0.04]"
              }`}
            >
              <span className="text-[16px] leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </BackendShell>
  );
}
