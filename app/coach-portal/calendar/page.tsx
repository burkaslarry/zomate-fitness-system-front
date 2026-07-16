"use client";

/**
 * [F008][S005]
 * Feature: Coach Session Management
 * Step: Redirect legacy month calendar — coaches use hourly schedule on /coach-portal
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoachPortalCalendarRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/coach-portal");
  }, [router]);
  return null;
}
