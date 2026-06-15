"use client";

/**
 * [F002][S001]
 * Feature: Course Entry & Automation
 * Step: Legacy /renewal redirect
 * Logic: Canonical route is /regCourse.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RenewalRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    const qs = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`/regCourse${qs}`);
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6 text-ink">
      <p className="text-sm text-ink/60">Redirecting to /regCourse…</p>
    </main>
  );
}
