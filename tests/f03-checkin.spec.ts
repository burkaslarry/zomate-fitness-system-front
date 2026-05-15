/**
 * [F003][S001]
 * Feature: Attendance & Today-Only QR Check-in
 * Step: (see Logic)
 * Logic: Student QR check-in UI and PIN flow.
 */

import { expect, test } from "@playwright/test";

test.describe("F03 check-in flow surfaces", () => {
  test("from=qr lands on search; step 3 hidden until lesson picked", async ({ page }) => {
    await page.goto("/student/checkin?from=qr");
    await expect(page.getByRole("heading", { name: "步驟 2 · 搜尋姓名或電話" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "步驟 3 · 輸入 PIN 扣堂" })).not.toBeVisible();

    await page.getByPlaceholder("英文全名或電話號碼…").fill("Larry");
    await page.getByRole("button", { name: "搜尋" }).click();
    await page.getByRole("button", { name: /Larry Lo/ }).click();

    const noLessonsToday = page.getByText(/今日沒有課堂要上/);
    const firstLesson = page.getByTestId("checkin-today-lesson").first();
    await noLessonsToday.or(firstLesson).waitFor({ state: "visible", timeout: 20_000 });
    if (await noLessonsToday.isVisible()) {
      test.skip(true, "Seed DB: Larry Lo needs a course with a lesson today for this assertion.");
    }
    await firstLesson.click();

    await expect(page.getByRole("heading", { name: "步驟 3 · 輸入 PIN 扣堂" })).toBeVisible();
    await expect(page.getByRole("button", { name: "確認" })).toBeDisabled();
  });

  test("no search result offers quick onboarding link", async ({ page }) => {
    await page.goto("/student/checkin?from=qr");
    await page.getByPlaceholder("英文全名或電話號碼…").fill("PLAYWRIGHT-NEW-STUDENT");
    await page.getByRole("button", { name: "搜尋" }).click();

    await expect(page.getByText("請輸入英文全名或電話號碼，然後按搜尋按鈕。")).toBeVisible();
    const quickLink = page.getByRole("link", { name: "即時登記學生" });
    await expect(quickLink).toBeVisible();
    await quickLink.click();

    await expect(page).toHaveURL(/\/student\/onboard\?quickName=/);
    await expect(page.getByRole("heading", { name: "新人入會 · F01" })).toBeVisible();
  });
});
