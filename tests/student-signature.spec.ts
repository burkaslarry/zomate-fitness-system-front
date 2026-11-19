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

/** [F006][S002] Login page no longer exposes the demo credential panel. */
test("login page has no credential help panel", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: { status: "ok" } }));
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "後台登入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "如何登入？" })).toHaveCount(0);
});

/** [F002][S003] Paper imports are labelled separately from the student's current overall balance. */
test("admin sees imported category package progress", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("zomate_auth_session", JSON.stringify({
    token: "offline-category-fixture", username: "fixture-admin", role: "ADMIN"
  })));
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { username: "fixture-admin", role: "ADMIN" } });
    if (path === "/api/members/by-id/404/full") return route.fulfill({ json: {
      profile: { id: 404, full_name: "Category QA Fixture", hkid: "QA404", phone: "90000000", lesson_balance: 20 },
      packages: [], course_checkin_pins: [], receipts: [], activity_log: [],
      category_enrollments: [{ id: 501, category_name: "Paper Package", status: "active", total_lessons: 30,
        lessons_already_taken: 17, remaining_from_paper: 13, started_at: "2026-10-23", installment_plans: [] }]
    } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/admin/students/404");
  await page.getByRole("button", { name: "課程記錄" }).click();
  await expect(page.getByText("已上（紙本）17 堂 · 剩（按紙本）13 堂")).toBeVisible();
  await expect(page.getByText("未包括其他簽到或扣堂", { exact: false })).toBeVisible();
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

/** [F003][S005] The long roster opens isolated, race-safe student details in the viewport. */
test("coach student details stay accessible with a long roster", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T00:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("zomate_auth_session", JSON.stringify({
    token: "offline-student-fixture", username: "fixture-coach", role: "COACH"
  })));
  const students = Array.from({ length: 100 }, (_, index) => {
    const id = index + 1;
    return {
      student_id: id, full_name: `Student ${String(id).padStart(3, "0")}`, phone: `90000${String(id).padStart(3, "0")}`,
      lesson_balance: 7, enrollment_count: 1, pending_schedule: false,
      packages: [{ enrollment_id: id + 1000, course_title: `Package ${id}`, branch_name: "QA Branch", branch_code: "QA",
        total_lessons: 10, used_lessons: 3, remaining_lessons: 7, coach_time_confirmed: true, payment_status: "Paid" }],
      category_packages: id === 1 ? [{ id: 501, category_name: "Paper Package", total_lessons: 30,
        lessons_already_taken: 17, remaining_from_paper: 13 }] : []
    };
  });
  let releaseSlow!: () => void;
  const slowResponse = new Promise<void>(resolve => { releaseSlow = resolve; });
  let slowStarted!: () => void;
  const slowRequest = new Promise<void>(resolve => { slowStarted = resolve; });
  let slowFinished!: () => void;
  const slowFinishedRequest = new Promise<void>(resolve => { slowFinished = resolve; });
  let firstSlow = true;
  let failures = 0;
  let bookings = 0;
  let bookingConflicts = 0;
  let reschedules = 0;
  const categoryBookings: Array<{ category_enrollment_id: number; day: string }> = [];
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) {
      if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.continue();
      return route.abort();
    }
    if (path === "/api/coach/me") return route.fulfill({ json: { id: 7, full_name: "Coach Fixture", phone: "90000000", branch_name: null } });
    if (path === "/api/auth/me") return route.fulfill({ json: { username: "fixture-coach", role: "COACH" } });
    if (path === "/api/coach/students") return route.fulfill({ json: students });
    if (path === "/api/coach/sessions") return route.fulfill({ json: [{
      enrollment_id: 1001, student_id: 1, student_name: "Student 001", student_phone: "90000001",
      category_id: 1, category_name: "Yoga", session_date: "2026-10-23", start_time: "09:00", end_time: "10:00",
      branch_name: "QA", checkin_pin: "00000", coach_time_confirmed: true, attendance_status: "未簽到", course_title: "Package 1"
    }] });
    if (path === "/api/coach/bookings" && request.method() === "POST") {
      if (bookingConflicts++ < 3) return route.fulfill({ status: 409, json: { detail: "conflict" } });
      bookings++;
      return route.fulfill({ json: { ok: true } });
    }
    if (path.includes("/reschedule") && request.method() === "PATCH") {
      reschedules++;
      return route.fulfill({ json: { ok: true } });
    }
    if (path === "/api/coach/category-bookings" && request.method() === "POST") {
      const body = request.postDataJSON();
      categoryBookings.push({ category_enrollment_id: body.category_enrollment_id, day: body.day });
      return route.fulfill({ json: { id: 9001 } });
    }
    const match = path.match(/^\/api\/coach\/students\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      if (id === 1 && firstSlow) {
        firstSlow = false;
        slowStarted();
        await slowResponse;
      }
      if (id === 3 && failures++ < 3) return route.fulfill({ status: 400, json: { detail: "Offline fixture failure" } });
      await route.fulfill({ json: {
        student_id: id, full_name: students[id - 1].full_name, phone: students[id - 1].phone, lesson_balance: 7,
        date_of_birth: "2000-01-01", emergency_contact_name: `Contact ${id}`,
        enrollments: [{ enrollment_id: id + 1000, course_title: `Package ${id}`, scheduled_start: "2026-10-23T09:00:00",
          scheduled_end: "2026-10-23T10:00:00", total_lessons: 10, coach_time_confirmed: true, payment_status: "Paid", installment_status: "Paid" }],
        category_enrollments: [{ id: 501, category_name: "Paper Package", total_lessons: 30, lessons_already_taken: 17, remaining_from_paper: 13 }],
        receipts: [], attendance: [], checkins: []
      } });
      if (id === 1) slowFinished();
      return;
    }
    if (request.method() !== "GET") return route.fulfill({ status: 400, json: { detail: "Unexpected fixture write" } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/coach-portal?tab=students");
  const first = page.getByRole("button", { name: /Student 001/ });
  const second = page.getByRole("button", { name: /Student 002/ });
  await expect(first).toContainText("Paper Package（紙本）：已上 17 · 剩 13");
  await expect(page.getByRole("button", { name: /Student 100/ })).toBeAttached();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await first.click();
  await slowRequest;
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  const dialog = page.getByRole("dialog", { name: "學員詳情 · Student 001" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("載入學員記錄…");
  await expect(dialog.getByLabel("Package 進度")).toContainText("已上 3 堂");
  await expect(dialog.getByLabel("Package 進度")).toContainText("剩 7 堂");
  const closeButton = dialog.getByRole("button", { name: "關閉學員詳情" });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(first).toBeFocused();
  await second.click();
  const secondDialog = page.getByRole("dialog", { name: "學員詳情 · Student 002" });
  await expect(secondDialog.getByText("Contact 2", { exact: false })).toBeVisible();
  releaseSlow();
  await slowFinishedRequest;
  await expect(secondDialog).toContainText("Contact 2");
  await expect(secondDialog).not.toContainText("Contact 1");
  await secondDialog.getByRole("button", { name: "關閉學員詳情" }).click();
  await first.click();
  const firstDialog = page.getByRole("dialog", { name: "學員詳情 · Student 001" });
  await expect(firstDialog.getByText("Contact 1", { exact: false })).toBeVisible();
  await expect(firstDialog.getByText("Paper Package · 總 30 堂")).toBeVisible();
  await expect(firstDialog.getByText("已上（紙本）17 堂 · 剩（按紙本）13 堂")).toBeVisible();
  await expect(firstDialog.getByText("未包括其他簽到或扣堂", { exact: false })).toBeVisible();
  await expect(firstDialog.getByRole("button", { name: "排這個舊 package（13 堂）" })).toBeVisible();
  await firstDialog.getByRole("button", { name: "排下一堂" }).click();
  await firstDialog.getByRole("button", { name: "確認", exact: true }).click();
  await expect(firstDialog.getByRole("alert")).toHaveText("此時段已被佔用，請另選時間。");
  await firstDialog.getByRole("button", { name: "確認", exact: true }).click();
  await expect(firstDialog).toBeHidden();
  await expect(page).toHaveURL(/tab=schedule/);
  expect(bookings).toBe(1);
  await page.locator("details").getByRole("button", { name: "改期", exact: true }).click();
  await expect(firstDialog.getByText("Contact 1", { exact: false })).toBeVisible();
  await expect(firstDialog.getByRole("button", { name: "確認", exact: true })).toBeVisible();
  await firstDialog.getByRole("button", { name: "確認", exact: true }).click();
  await expect(firstDialog).toBeHidden();
  expect(reschedules).toBe(1);
  await page.goto("/coach-portal?tab=students");
  await page.getByRole("button", { name: /Student 003/ }).click();
  const thirdDialog = page.getByRole("dialog", { name: "學員詳情 · Student 003" });
  await expect(thirdDialog.getByRole("alert")).toContainText("未能載入學員記錄");
  await thirdDialog.getByRole("button", { name: "重試" }).click();
  await expect(thirdDialog.getByText("Contact 3", { exact: false })).toBeVisible();
  await page.goto("/coach-portal?tab=students");
  await page.getByRole("button", { name: /Student 001/ }).click();
  const scheduleDialog = page.getByRole("dialog", { name: "學員詳情 · Student 001" });
  await scheduleDialog.getByRole("button", { name: "排這個舊 package（13 堂）" }).click();
  await expect(scheduleDialog.getByText("排程只建立剩餘紙本堂數的 Course", { exact: false })).toBeVisible();
  await scheduleDialog.getByRole("button", { name: "確認排程" }).click();
  await expect(page).toHaveURL(/tab=schedule/);
  expect(categoryBookings).toHaveLength(1);
  expect(categoryBookings[0].category_enrollment_id).toBe(501);
});
