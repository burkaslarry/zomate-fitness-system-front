"use client";

import { useDemoState } from "../lib/demo-state";

export function useWhatsAppLog() {
  const { appendWhatsAppLog } = useDemoState();

  function logOnboardingSuccess(name: string, phone: string, pin: string) {
    appendWhatsAppLog({
      recipient: phone,
      message: `Welcome ${name}, onboarding completed. PIN: ${pin}.`,
      status: "Delivered"
    });
  }

  function logCheckinSuccess(name: string, phone: string, remainingCredits?: number) {
    const suffix = typeof remainingCredits === "number" ? ` Remaining credits: ${remainingCredits}.` : "";
    appendWhatsAppLog({
      recipient: phone,
      message: `${name} check-in success.${suffix}`,
      status: "Delivered"
    });
  }

  return {
    logOnboardingSuccess,
    logCheckinSuccess
  };
}
