"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: Package picker — student may hold several packages; coach picks one before the time sheet.
 */

import CoachBottomSheet from "./coach-bottom-sheet";

export type PackagePickRow = {
  enrollment_id: number;
  course_title: string;
  branch_name?: string | null;
  total_lessons: number;
  remaining_lessons: number;
  coach_time_confirmed: boolean;
  installment_status: string;
  /** [F003][S005] Lesson range per installment period — when each tranche is due. */
  periods?: { installment_no: number; lesson_from: number; lesson_to: number; paid: boolean }[];
};

type Props = {
  open: boolean;
  studentName: string;
  packages: PackagePickRow[];
  busy?: boolean;
  onClose: () => void;
  onPick: (row: PackagePickRow) => void;
};

export default function CoachSchedulePackagePickerSheet({
  open,
  studentName,
  packages,
  busy = false,
  onClose,
  onPick
}: Props) {
  return (
    <CoachBottomSheet
      open={open}
      onClose={onClose}
      title={`${studentName} · 揀 Package`}
      ariaLabelledBy="coach-package-picker-title"
      heightClass="h-[min(70vh,520px)] max-h-[70vh]"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {busy ? <p className="mb-3 text-xs text-primary">載入學員課程…</p> : null}
        <p className="mb-3 text-xs text-ink/55">一個學員可以有多個 package；請揀邊個 package 去約時間。</p>
        {packages.length === 0 ? (
          <p className="text-sm text-ink/45">此學員暫無可排程課程。</p>
        ) : (
          <ul className="space-y-2">
            {packages.map((p) => (
              <li key={p.enrollment_id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(p)}
                  className="w-full rounded-xl border border-ink/10 bg-canvas px-3 py-2.5 text-left text-sm transition hover:border-primary/35 disabled:opacity-50"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="font-medium text-ink">{p.course_title}</span>
                    <span className="text-xs text-ink/55">{p.branch_name ?? "—"}</span>
                  </div>
                  <div className="mt-0.5 text-xs tabular-nums text-ink/60">
                    總 {p.total_lessons} 堂 · 剩 {p.remaining_lessons} 堂
                    {p.coach_time_confirmed ? "" : " · 待排程"}
                  </div>
                  {p.periods && p.periods.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink/55">
                      {p.periods.map((per) => (
                        <span key={per.installment_no}>
                          第{per.installment_no}期 第{per.lesson_from}–{per.lesson_to}堂
                          {per.paid ? "（已付）" : "（未付）"}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-0.5 text-[11px] text-ink/45">{p.installment_status}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CoachBottomSheet>
  );
}
