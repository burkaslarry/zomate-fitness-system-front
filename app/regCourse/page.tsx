"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Staff regCourse page — wraps shared wizard in admin shell (mobile-first)
 */

import BackendShell from "../../components/backend-shell";
import RegCourseWizard from "../../components/reg-course-wizard";

export default function RegCoursePage() {
  return (
    <BackendShell title="報 Course / 收費">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <RegCourseWizard mode="staff" homeHref="/admin" />
      </div>
    </BackendShell>
  );
}
