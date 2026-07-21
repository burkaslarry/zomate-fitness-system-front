/**
 * [F005][S003]
 * Feature: Balance Sync & Integrations
 * Step: wa.me deep links for manual WhatsApp send
 * Logic: Normalize HK phone to 852 prefix; encode message for click-to-send.
 */

/** Build wa.me URL — staff clicks, WhatsApp opens with pre-filled message. */
export function waMeLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const hk = digits.startsWith("852") ? digits : `852${digits.replace(/^0+/, "")}`;
  return `https://wa.me/${hk}?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppLink(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** [F005][S003] PIN success message for coach reg-course WhatsApp button. */
export function buildPinWhatsAppMessage(payload: {
  studentName: string;
  courseTitle: string;
  checkinPin: string;
  branchName?: string;
  installmentSegments?: Array<{ installment_no: number; pin: string; paid: boolean }>;
}): string {
  const lines = [
    `【Zomate Fitness】${payload.studentName} 你好 👋`,
    "",
    `你的課程已確認：${payload.courseTitle}`,
    `📍 ${payload.branchName ?? "Zomate Fitness"}`,
    "",
    `課堂簽到 PIN：${payload.checkinPin}`
  ];
  if (payload.installmentSegments && payload.installmentSegments.length > 1) {
    lines.push("", "分期 PIN：");
    for (const seg of payload.installmentSegments) {
      lines.push(`第 ${seg.installment_no} 期：${seg.pin}${seg.paid ? "（可簽到）" : "（待付款）"}`);
    }
  }
  lines.push("", "上堂日請用 PIN 簽到。如有疑問請聯絡我們，謝謝！", "— Zomate Fitness");
  return lines.join("\n");
}
