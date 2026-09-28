"use client";

/**
 * [F003][S009]
 * Feature: Coach Session Management
 * Step: Confirm one-lesson vs whole-course cancellation
 * Logic: State the exact impact before the coach performs a destructive calendar action.
 */

type Props = {
  open: boolean;
  scope: "session" | "course";
  studentName: string;
  courseTitle: string;
  sessionLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function CoachCancelConfirmDialog({
  open,
  scope,
  studentName,
  courseTitle,
  sessionLabel,
  busy = false,
  onClose,
  onConfirm
}: Props) {
  if (!open) return null;

  const wholeCourse = scope === "course";
  return (
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center bg-black/55 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-cancel-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
          {wholeCourse ? "高風險操作" : "取消今堂"}
        </p>
        <h2 id="coach-cancel-dialog-title" className="mt-2 text-lg font-semibold text-ink">
          {wholeCourse ? "確定取消整個課程？" : "確定只取消這一堂？"}
        </h2>
        <div className="mt-3 rounded-xl border border-ink/10 bg-canvas p-3 text-sm text-ink/75">
          <p className="font-medium text-ink">{studentName} · {courseTitle}</p>
          {sessionLabel ? <p className="mt-1">{sessionLabel}</p> : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-ink/70">
          {wholeCourse
            ? "整個 enrollment 的全部堂數會從日曆移除。學生、付款及已簽到紀錄不會刪除，但成套課程會停止顯示。"
            : "只有這一堂會從日曆移除；其他堂數、課堂 PIN、付款及之後課堂全部保留。"}
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          改期或取消須最少於課堂開始前 24 小時處理。
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 rounded-xl border border-ink/15 bg-surface px-4 py-2.5 text-sm font-semibold text-ink"
          >
            返回
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-11 rounded-xl border border-red-700 bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
          >
            {busy ? "處理中…" : wholeCourse ? "取消整個課程" : "只取消今堂"}
          </button>
        </div>
      </div>
    </div>
  );
}
