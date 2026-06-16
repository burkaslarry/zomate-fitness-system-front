"use client";

/**
 * [F003][S008]
 * Feature: Coach student follow-up (admin)
 * Step: Grid of attendance, next lesson, installment payment reminders
 * Logic: GET /api/admin/coaches/{coach_id}/student-follow-up
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BackendShell from "../../../../../components/backend-shell";
import { alertApiError, api } from "../../../../../lib/api";
import type { CoachStudentFollowUpDto } from "../../../../../types/api";

export default function AdminCoachStudentsFollowUpPage() {
  const params = useParams();
  const coachId = Number(params.coachId);
  const [coachName, setCoachName] = useState("");
  const [rows, setRows] = useState<CoachStudentFollowUpDto[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(coachId) || coachId < 1) {
      setStatus("Invalid coach id.");
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const [coachesRaw, followRaw] = await Promise.all([
          api.coaches() as Promise<{ id: number; full_name: string }[]>,
          api.coachStudentFollowUp(coachId) as Promise<CoachStudentFollowUpDto[]>
        ]);
        const coach = Array.isArray(coachesRaw) ? coachesRaw.find((c) => c.id === coachId) : undefined;
        setCoachName(coach?.full_name ?? `Coach #${coachId}`);
        setRows(Array.isArray(followRaw) ? followRaw : []);
      } catch (err) {
        alertApiError(err);
        setStatus(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [coachId]);

  return (
    <BackendShell title={`Student follow up · ${coachName || "…"}`}>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin/coaches" className="text-xs text-primary underline-offset-2 hover:underline">
              ← 返回教練管理
            </Link>
            <h2 className="mt-1 text-2xl font-semibold text-ink">
              Student follow up by {coachName || "…"}
            </h2>
          </div>
        </div>

        {loading ? <p className="text-sm text-ink/55">載入中…</p> : null}
        {status ? <p className="text-sm text-rose-700">{status}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface shadow-sm ring-1 ring-ink/[0.04]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="border-b border-ink/10 bg-canvas/80 text-xs text-ink/60">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">學員</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium">電話</th>
                <th className="px-4 py-3 font-medium">上堂狀態 Attendance</th>
                <th className="px-4 py-3 font-medium">下一堂 Next lesson</th>
                <th className="px-4 py-3 font-medium">分期催款 Payment reminder</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                    此教練暫無指派學員。
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.student_id} className="border-b border-ink/[0.06] text-ink/85">
                    <td className="px-4 py-3 font-medium text-ink">{row.full_name}</td>
                    <td className="whitespace-nowrap px-4 py-3">{row.phone}</td>
                    <td className="px-4 py-3 text-xs">{row.attendance_status}</td>
                    <td className="px-4 py-3 text-xs">{row.next_lesson}</td>
                    <td className="px-4 py-3 text-xs">
                      {row.payment_reminder ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">
                          {row.payment_reminder}
                        </span>
                      ) : (
                        <span className="text-ink/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </BackendShell>
  );
}
