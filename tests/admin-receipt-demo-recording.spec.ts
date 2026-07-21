/**
 * [F005][S003]
 * Demo: Admin student detail — signature, WhatsApp receipt prompt, upload receipt UI
 */

import { test, expect } from "@playwright/test";

const STUDENT_ID = process.env.DEMO_STUDENT_ID ?? "40";

test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: "on", size: { width: 1280, height: 720 } },
  launchOptions: { slowMo: 350 }
});

test("record admin receipt + WhatsApp demo", async ({ page, context }) => {
  test.setTimeout(180_000);

  await page.goto("/login?logout=1");
  await page.getByLabel("帳號").fill("masterzoe");
  await page.getByLabel("密碼").fill("12345678");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.waitForURL("**/admin**", { timeout: 45_000 });
  await page.waitForTimeout(1200);

  await page.goto(`/admin/students/${STUDENT_ID}`);
  await expect(page.getByText("簽名圖")).toBeVisible({ timeout: 25_000 });
  await page.waitForTimeout(2000);

  const waBtn = page.getByRole("button", { name: /WhatsApp 請上傳收據/ });
  if ((await waBtn.count()) > 0) {
    const popupPromise = context.waitForEvent("page", { timeout: 8000 }).catch(() => null);
    await waBtn.first().click();
    await popupPromise;
    await page.waitForTimeout(1500);
  }

  const uploadBtn = page.getByRole("button", { name: /^上傳收據$/ });
  if ((await uploadBtn.count()) > 0) {
    await uploadBtn.first().click();
  } else {
    await page.locator("button").filter({ hasText: /^課程記錄$/ }).click();
    await uploadBtn.first().click();
  }
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel("上傳收據（圖片／PDF）")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Success dialog appears only after a real upload — verify upload modal is reachable.

  await page.locator("button").filter({ hasText: /^付款紀錄$/ }).click();
  await expect(page.getByText("Payment Record")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2500);
});
