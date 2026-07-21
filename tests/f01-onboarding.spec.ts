/**
 * [F006][S005]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Playwright feature specs for smoke paths.
 */

import { expect, test } from "@playwright/test";

test.describe("F01 onboarding validations", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/members/duplicate-check", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ blocked: false })
      });
    });
  });

  test("HKID short format (A123) is accepted without old min-8 error", async ({ page }) => {
    await page.goto("/register");

    await page.locator('input[name="chinese_name"]').fill("測試用戶");
    await page.locator('input[name="full_name"]').fill("Playwright User");
    await page.locator('input[name="hkid"]').fill("A123");
    await page.locator('input[name="emergency_contact_relationship"]').click();

    await expect(page.getByText("Too small: expected string to have >=8 characters")).toHaveCount(0);
    await expect(page.getByText("請至少輸入 4 個字元（例：英文字 + 頭幾個數字 · A123）")).toHaveCount(0);
  });

  test("HK phone keeps +852 and requires exactly 8 digits", async ({ page }) => {
    await page.goto("/register");

    await page.locator('input[name="chinese_name"]').fill("測試");
    await page.locator('input[name="full_name"]').fill("Playwright User");
    await page.locator('input[name="hkid"]').fill("A124");
    await page.getByPlaceholder("12345678").fill("1234567");
    await page.locator('input[name="emergency_contact_name"]').fill("Emergency Contact");
    await page.locator('input[name="emergency_contact_relationship"]').fill("朋友");
    await page.getByPlaceholder("87654321").fill("87654321");

    await page.getByRole("button", { name: "下一步" }).click();

    await expect(page.getByText("請輸入香港手機號碼 8 位數字（自動帶 +852）")).toBeVisible();
    await expect(page.getByText("Too small: expected string to have >=8 characters")).toHaveCount(0);
  });

  test("PAR-Q yes answers allow optional medical upload — next step is not blocked", async ({ page }) => {
    const uniqNum = Number(Date.now().toString().slice(-6));
    const phone8 = String(90000000 + uniqNum).slice(0, 8);
    const emergencyPhone8 = String(60000000 + uniqNum).slice(0, 8);
    await page.goto("/register");

    await page.locator('input[name="chinese_name"]').fill("測試");
    await page.locator('input[name="full_name"]').fill("Playwright User");
    await page.locator('input[name="hkid"]').fill(`Z${String(uniqNum).slice(-4)}`);
    await page.getByPlaceholder("12345678").fill(phone8);
    await page.locator('input[type="date"]').fill("1990-01-15");
    await page.locator('input[name="emergency_contact_name"]').fill("Emergency Contact");
    await page.locator('input[name="emergency_contact_relationship"]').fill("家人");
    await page.getByPlaceholder("87654321").fill(emergencyPhone8);

    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByText("醫生曾說你有心臟問題，只宜於醫生建議下運動？")).toBeVisible();

    await page.locator('input[type="checkbox"]').first().check();

    const nextBtn = page.getByRole("button", { name: "下一步" });
    await expect(nextBtn).toBeEnabled();

    await page.getByTestId("parq-medical-upload").setInputFiles({
      name: "clearance.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test")
    });
    await expect(page.getByText(/已接收檔案：clearance\.pdf/)).toBeVisible();
    await nextBtn.click();

    await expect(page.locator("[data-pdpo-ack]")).toBeVisible({ timeout: 15_000 });
  });

  test("successful submit shows application popup without displaying PIN", async ({ page }) => {
    await page.route("**/api/members", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ member: { hkid: "Z9001", full_name: "Popup User" }, pin_code: "12345" })
      });
    });

    await page.goto("/register");

    await page.locator('input[name="chinese_name"]').fill("測試");
    await page.locator('input[name="full_name"]').fill("Popup User");
    await page.locator('input[name="hkid"]').fill("Z9001");
    await page.getByPlaceholder("12345678").fill("91234567");
    await page.locator('input[name="emergency_contact_name"]').fill("Emergency Contact");
    await page.locator('input[name="emergency_contact_relationship"]').fill("朋友");
    await page.getByPlaceholder("87654321").fill("61234567");
    await page.getByRole("button", { name: "下一步" }).click();

    await page.locator('input[type="checkbox"]').first().check();
    await page.getByTestId("parq-medical-upload").setInputFiles({
      name: "clearance.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test")
    });
    await expect(page.getByText(/已接收檔案：clearance\.pdf/)).toBeVisible();
    await page.getByRole("button", { name: "下一步" }).click();

    await expect(page.locator("[data-pdpo-ack]")).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-pdpo-ack] input[type="checkbox"]').check();
    await page.locator('[data-cooling-ack] input[type="checkbox"]').check();
    await page.locator('[data-disclaimer-ack] input[type="checkbox"]').check();
    await page.locator('input[name="digital_signature"]').fill("Popup User");
    await page.getByRole("button", { name: "提交登記" }).click();

    await expect(page.getByRole("heading", { name: "申請成功" })).toBeVisible();
    await expect(page.getByRole("button", { name: "上傳照片" })).toBeVisible();
    await expect(page.getByText("簽到 PIN")).toHaveCount(0);
  });
});
