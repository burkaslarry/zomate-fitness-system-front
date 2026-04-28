"use client";

import { useEffect, useState } from "react";
import StudentOnboardingWizard from "../../../components/onboarding/student-onboarding-wizard";
import { usePeriodicHealthPing } from "../../../hooks/use-periodic-health-ping";

/** @feature [F01.1][F01.2][F01.3] */

export default function StudentOnboardPage() {
  usePeriodicHealthPing();
  const [quickName, setQuickName] = useState<string | undefined>();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const name = new URLSearchParams(window.location.search).get("quickName");
    if (name) setQuickName(name);
  }, []);

  return <StudentOnboardingWizard quickName={quickName} />;
}
