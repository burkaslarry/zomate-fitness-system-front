"use client";

/**
 * [F002][S003]
 * Feature: Course Entry & Automation
 * Step: Coach portal — register course for assigned students
 */

import { useEffect, useState } from "react";
import RegCourseWizard from "../../../components/reg-course-wizard";
import { alertApiError, api } from "../../../lib/api";
import { getAuthSession } from "../../../lib/auth";

type CoachMe = { id: number; full_name: string; branch_name: string | null; branch_id?: number | null };

export default function CoachPortalRegCoursePage() {
  const [coach, setCoach] = useState<CoachMe | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const session = getAuthSession();
    if (session?.role !== "COACH") {
      setDenied(true);
      return;
    }
    void api
      .coachMe()
      .then((row) => setCoach(row as CoachMe))
      .catch((err) => alertApiError(err));
  }, []);

  if (denied) {
    return <p className="px-3 py-8 text-center text-sm text-ink/60">請以教練帳號登入。</p>;
  }

  if (!coach) {
    return <p className="px-3 py-8 text-center text-sm text-ink/50">載入中…</p>;
  }

  return (
    <div className="px-3 py-4 md:px-4">
      <h1 className="mb-3 text-lg font-semibold text-ink sm:text-xl">替學員報 Course</h1>
      <RegCourseWizard
        mode="coach"
        lockedCoachId={coach.id}
        lockedCoachName={coach.full_name}
        lockedBranchId={coach.branch_id ?? null}
        homeHref="/coach-portal"
      />
    </div>
  );
}
