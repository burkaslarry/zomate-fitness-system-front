/** [F003][S004] Same-day initial staff booking UI with intercepted API; no real messages. */
import { test, expect } from "@playwright/test";

test.use({ channel: process.env.SIGNATURE_TEST_BROWSER_CHANNEL, video: "off", timezoneId: "Asia/Hong_Kong" });

test("coach can submit today's first booking without a 72-hour client block", async ({ page }) => {
  // [F007][S005] Freeze at 15:05 HKT and isolate every API route.
  await page.clock.setFixedTime(new Date("2026-10-23T07:05:00Z"));
  await page.addInitScript(() => localStorage.setItem("zomate_auth_session", JSON.stringify({
    token: "offline-booking-fixture", username: "fixture-coach", role: "COACH"
  })));
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/**", async route => {
    // [F007][S005] Capture booking payload in memory instead of writing customer data.
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { username: "fixture-coach", role: "COACH" } });
    if (path === "/api/coach/me") return route.fulfill({ json: { id: 7, full_name: "QA Coach", phone: "90000001" } });
    if (path === "/api/coach/pending-students") return route.fulfill({ json: [{
      enrollment_id: 88, course_id: 88, student_id: 404, student_name: "Same-day QA",
      student_phone: "90000002", course_title: "QA Course", branch_name: "QA",
      total_lessons: 3, placeholder_start: "2026-11-02T15:00:00"
    }] });
    if (path === "/api/coach/bookings") {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { id: 88 } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/coach-portal");
  await page.getByRole("button", { name: "Same-day QA", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "揀時段排程" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("2026年10月23日");
  await expect(sheet).toContainText("今日未完結時段");
  await expect(sheet.getByRole("button", { name: "上一日" })).toBeDisabled();
  await sheet.getByLabel("開始 · 鐘數").selectOption("15");
  const confirm = sheet.getByRole("button", { name: "確認排程", exact: true });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => submitted).toMatchObject({ enrollment_id: 88, day: "2026-10-23", start_hour: 15 });
});
