/**
 * [F003][S011]
 * Demo: Mary Ma · Pilates 1對1 · 12:15 start · 1h → 學員 tab
 */

import { test, expect } from "@playwright/test";

const TARGET_DAY_LABEL = /2026年7月22日/;
const STEPS_TO_JUL22 = 5;

test.use({
  viewport: { width: 405, height: 720 },
  isMobile: true,
  hasTouch: true,
  video: { mode: "on", size: { width: 405, height: 720 } },
  launchOptions: { slowMo: 400 }
});

test("record Mary Ma schedule demo with 12:15 start", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/login?logout=1");
  await page.getByLabel("帳號").fill("funglo");
  await page.getByLabel("密碼").fill("12345666");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.waitForURL("**/coach-portal**", { timeout: 30_000 });
  await page.waitForTimeout(1500);

  await page.goto("/coach-portal?tab=schedule");
  await expect(page.getByRole("heading", { name: "學員排期上堂" })).toBeVisible();
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: /Mary Ma/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /揀時段排程/ }).click();
  await expect(page.getByRole("heading", { name: "揀時段排程" })).toBeVisible();
  await page.waitForTimeout(1000);

  const nextDay = page.getByRole("button", { name: "下一日" });
  for (let i = 0; i < STEPS_TO_JUL22; i++) {
    await nextDay.click();
    await page.waitForTimeout(180);
  }
  await expect(page.locator("text=2026年7月22日").first()).toBeVisible();
  await page.waitForTimeout(600);

  await page.getByLabel("開始 · 鐘數").selectOption("12");
  await page.getByLabel("開始 · 分鐘").selectOption("15");
  await page.locator("select").filter({ hasText: "1 hr" }).last().selectOption("1");
  await page.waitForTimeout(1000);
  await expect(page.getByText("12:15")).toBeVisible();
  await expect(page.getByText("13:15")).toBeVisible();

  await page.getByRole("button", { name: "確認排程" }).click();
  await expect(page.getByRole("heading", { name: /Mary Ma/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(TARGET_DAY_LABEL)).toBeVisible();
  await expect(page.getByText("12:15 → 13:15")).toBeVisible();
  await page.waitForTimeout(2500);

  await page.getByRole("button", { name: "查看學員" }).click();
  await page.waitForURL("**/coach-portal?tab=students**", { timeout: 15_000 });
  await page.getByRole("button", { name: /Mary Ma/ }).click();
  await expect(page.getByText(/Pilates|普拉提/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/12:15|7月22日/)).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(3500);
});
