/** [F001][S004] Missing-signature UI: isolated API fixtures, never real students or signatures. */
import { test, expect } from "@playwright/test";

// [F007][S005] Use installed Chrome when the optional channel is supplied.
test.use({ channel: process.env.SIGNATURE_TEST_BROWSER_CHANNEL, video: "off" });

test("student can clear, retry a failed save and reload a persisted signature", async ({ page }) => {
  // [F007][S005] A fake staff session and intercepted API isolate this test from production.
  await page.addInitScript(() => localStorage.setItem("zomate_auth_session", JSON.stringify({
    token: "offline-signature-fixture", username: "fixture-admin", role: "ADMIN"
  })));
  let png = "";
  let writes = 0;
  await page.route("**/api/**", async (route) => {
    // [F007][S005] Persist only in test memory and inject one failed submission.
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/me")) {
      return route.fulfill({ json: { username: "fixture-admin", role: "ADMIN", is_master_admin: true } });
    }
    if (path === "/api/members/by-id/404/full") {
      return route.fulfill({ json: {
        profile: { id: 404, full_name: "Signature QA Fixture", hkid: "QA404", phone: "90000000", lesson_balance: 0, signature_image_url: png ? "/api/members/by-id/404/signature" : null },
        packages: [], category_enrollments: [], course_checkin_pins: [], receipts: [], activity_log: []
      } });
    }
    if (path === "/api/coach/students/404/signature") {
      writes++;
      if (writes <= 3) return route.fulfill({ status: 400, json: { detail: "Offline simulated failure" } });
      png = route.request().postDataJSON().digital_signature;
      return route.fulfill({ json: { ok: true, signature_image_url: "/api/members/by-id/404/signature" } });
    }
    if (path === "/api/members/by-id/404/signature") {
      return route.fulfill({ contentType: "image/png", body: Buffer.from(png.split(",")[1], "base64") });
    }
    return route.fulfill({ json: [] });
  });
  page.on("dialog", dialog => void dialog.dismiss());
  await page.goto("/admin/students/404");
  const canvas = page.getByLabel("電子簽署手寫區");
  const submit = page.getByRole("button", { name: "提交", exact: true });
  await expect(canvas).toBeVisible();
  await expect(submit).toBeDisabled();
  // [F007][S005] Draw synthetic strokes with pointer input; no genuine user signature is used.
  async function draw() {
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Signature canvas is missing");
    await canvas.scrollIntoViewIfNeeded();
    const visible = await canvas.boundingBox();
    if (!visible) throw new Error("Signature canvas is missing");
    await page.mouse.move(visible.x + 30, visible.y + 35);
    await page.mouse.down();
    await page.mouse.move(visible.x + 95, visible.y + 80, { steps: 12 });
    await page.mouse.up();
  }
  await draw();
  await expect(submit).toBeEnabled();
  await page.getByRole("button", { name: "清除", exact: true }).click();
  await expect(submit).toBeDisabled();
  expect(writes).toBe(0);
  await draw();
  await submit.click();
  await expect(page.getByRole("alert").filter({ hasText: "簽名未能儲存" })).toContainText("簽名未能儲存");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByAltText("Signature QA Fixture 簽名")).toBeVisible();
  expect(png).toMatch(/^data:image\/png;base64,/);
  expect(writes).toBe(4);
  await page.reload();
  await expect(page.getByAltText("Signature QA Fixture 簽名")).toBeVisible();
  await expect(canvas).toHaveCount(0);
});

/** [F006][S002] User-requested coach account is discoverable in login help. */
test("login help includes Fung coach", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: { status: "ok" } }));
  await page.goto("/login");
  await page.getByRole("button", { name: "如何登入？", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("funglo / 60552936（COACH · Fung 教練）");
});

/** [F008][S005] Collapsing the agenda never hides the calendar or changes lesson actions. */
test("coach sees expandable sessions before calendar", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T00:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("zomate_auth_session", JSON.stringify({
    token: "offline-coach-fixture", username: "fixture-coach", role: "COACH"
  })));
  await page.route("**/api/**", async route => {
    // [F007][S005] Coach-only fixture reads: no bookings, cancellation or real notifications.
    const url = new URL(route.request().url());
    if (url.pathname === "/api/coach/me") return route.fulfill({ json: { id: 7, full_name: "Coach Fixture", phone: "90000000", branch_name: null } });
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { username: "fixture-coach", role: "COACH" } });
    if (url.pathname === "/api/coach/sessions") return route.fulfill({ json: [{
      enrollment_id: 88, student_id: 404, student_name: "Session QA Fixture", student_phone: "90000001",
      category_id: 1, category_name: "Yoga", session_date: url.searchParams.get("day") ?? "2026-10-23",
      start_time: "09:00", end_time: "10:00", branch_name: "QA", checkin_pin: "00000",
      coach_time_confirmed: true, attendance_status: "未簽到", course_title: "QA Lesson"
    }] });
    return route.fulfill({ json: [] });
  });
  await page.goto("/coach-portal");
  const agenda = page.locator("details");
  const summary = agenda.locator("summary");
  const calendar = page.getByRole("heading", { name: "日曆 · 學員上堂" });
  await expect(agenda.getByText("Session QA Fixture", { exact: true })).toBeVisible();
  await expect(agenda.getByRole("button", { name: "改期", exact: true })).toBeVisible();
  const agendaBox = await agenda.boundingBox();
  const calendarBox = await calendar.boundingBox();
  expect(agendaBox!.y).toBeLessThan(calendarBox!.y);
  await summary.click();
  await expect(agenda.getByRole("button", { name: "改期", exact: true })).toBeHidden();
  await expect(calendar).toBeVisible();
  await summary.focus();
  await summary.press("Enter");
  await expect(agenda.getByRole("button", { name: "取消今堂", exact: true })).toBeVisible();
});
