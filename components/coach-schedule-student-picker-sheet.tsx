"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: FAB student picker — choose who to schedule before bottom sheet
 */

import CoachBottomSheet from "./coach-bottom-sheet";

type PendingRow = {
  enrollment_id: number;
  course_id?: number;
  student_id: number;
  student_name: string;
  student_phone?: string;
  course_title: string;
  branch_name: string;
  total_lessons: number;
  placeholder_start?: string;
};

type StudentRow = {
  student_id: number;
  full_name: string;
  lesson_balance: number;
  enrollment_count: number;
  pending_schedule?: boolean;
};

type Props = {
  open: boolean;
  pending: PendingRow[];
  students: StudentRow[];
  busy?: boolean;
  onClose: () => void;
  onPickPending: (row: PendingRow) => void;
  onPickStudent: (studentId: number) => void;
};

export default function CoachScheduleStudentPickerSheet({
  open,
  pending,
  students,
  busy = false,
  onClose,
  onPickPending,
  onPickStudent
}: Props) {
  return (
    <CoachBottomSheet
      open={open}
      onClose={onClose}
      title="揀學員排程"
      ariaLabelledBy="coach-student-picker-title"
      heightClass="h-[min(75vh,560px)] max-h-[75vh]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {busy ? <p className="mb-3 text-xs text-primary">載入學員課程…</p> : null}

        {pending.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">待排期</p>
            <ul className="space-y-2">
              {pending.map((p) => (
                <li key={p.enrollment_id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPickPending(p)}
                    className="w-full rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-left text-sm transition hover:bg-primary/15 disabled:opacity-50"
                  >
                    <div className="font-medium text-ink">{p.student_name}</div>
                    <div className="mt-0.5 text-xs text-ink/60">
                      {p.course_title} · {p.total_lessons} 堂
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">全部學員</p>
          {students.length === 0 ? (
            <p className="text-sm text-ink/45">目前沒有指派學員。</p>
          ) : (
            <ul className="space-y-2">
              {students.map((s) => (
                <li key={s.student_id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPickStudent(s.student_id)}
                    className="w-full rounded-xl border border-ink/10 bg-canvas px-3 py-2.5 text-left text-sm transition hover:border-primary/35 disabled:opacity-50"
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
        </div>
      </div>
    </CoachBottomSheet>
  );
}
