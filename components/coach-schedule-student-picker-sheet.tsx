"use client";

/**
 * [F003][S003]
 * Feature: Coach Dashboard
 * Step: FAB student picker — choose who to schedule, 其他事項, or a new-student 試堂
 */

import { useEffect, useState } from "react";
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

type TrialDraft = { name: string; phone: string; notes: string };

type Props = {
  open: boolean;
  pending: PendingRow[];
  students: StudentRow[];
  busy?: boolean;
  onClose: () => void;
  onPickPending: (row: PendingRow) => void;
  onPickStudent: (studentId: number) => void;
  /** [F003][S003] Private calendar mark — no student lesson. */
  onPickPersonal?: () => void;
  /** [F003][S003] New-student 試堂 — name + phone required, note optional. */
  onPickTrial?: (trial: TrialDraft) => void;
};

export default function CoachScheduleStudentPickerSheet({
  open,
  pending,
  students,
  busy = false,
  onClose,
  onPickPending,
  onPickStudent,
  onPickPersonal,
  onPickTrial
}: Props) {
  const [trialOpen, setTrialOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setTrialOpen(false);
      setName("");
      setPhone("");
      setNotes("");
      setError("");
    }
  }, [open]);

  function submitTrial(e: React.FormEvent) {
    e.preventDefault();
    if (!onPickTrial) return;
    if (name.trim().length < 2) {
      setError("請輸入試堂學生姓名。");
      return;
    }
    if (phone.replace(/\D/g, "").length < 8) {
      setError("請輸入有效電話（至少 8 位數字）。");
      return;
    }
    setError("");
    onPickTrial({ name: name.trim(), phone: phone.trim(), notes: notes.trim() });
  }

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

        {onPickTrial ? (
          <div className="mb-4">
            {trialOpen ? (
              <form onSubmit={submitTrial} className="rounded-xl border border-red-300 bg-red-50/70 p-3">
                <p className="text-sm font-semibold text-red-950">新學生試堂</p>
                <div className="mt-2 space-y-2">
                  <label className="block">
                    <span className="text-[11px] text-red-900/70">學生姓名</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="新學生姓名"
                      className="mt-0.5 w-full rounded-md border border-red-300 bg-white px-2.5 py-2 text-sm"
                      autoFocus
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-red-900/70">電話</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="8 位電話"
                      className="mt-0.5 w-full rounded-md border border-red-300 bg-white px-2.5 py-2 text-sm tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-red-900/70">備註（可留空）</span>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="例如：想試教練 / 想試器械"
                      className="mt-0.5 w-full rounded-md border border-red-300 bg-white px-2.5 py-2 text-sm"
                    />
                  </label>
                </div>
                {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTrialOpen(false)}
                    className="min-h-10 flex-1 rounded-lg border border-red-300 bg-white px-3 text-sm text-red-900"
                  >
                    返回
                  </button>
                  <button
                    type="submit"
                    className="min-h-10 flex-1 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white"
                  >
                    下一步：排時間
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setTrialOpen(true)}
                className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-3 text-left text-sm font-medium text-red-950 transition hover:border-red-400 disabled:opacity-50"
              >
                <div className="font-semibold">新增學生試堂</div>
                <div className="mt-0.5 text-xs font-normal text-red-900/70">
                  新學生＋電話＋備註（可留空）· 日曆用紅色標示
                </div>
              </button>
            )}
          </div>
        ) : null}

        {onPickPersonal && !trialOpen ? (
          <button
            type="button"
            disabled={busy}
            onClick={onPickPersonal}
            className="mb-4 w-full rounded-xl border border-ink/20 bg-canvas px-3 py-3 text-left text-sm font-medium text-ink transition hover:border-primary/40 disabled:opacity-50"
          >
            <div className="font-semibold">其他事項</div>
            <div className="mt-0.5 text-xs font-normal text-ink/55">私人事項標記入日曆（唔係學生課堂）</div>
          </button>
        ) : null}

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
