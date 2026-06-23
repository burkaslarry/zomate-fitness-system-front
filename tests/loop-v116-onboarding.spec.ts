/**
 * [F001][S004]
 * Loop v1.16 Suite A — signature canvas resize resilience + blank submit error UI.
 */

import { expect, test } from "@playwright/test";

test.describe("Loop v1.16 Suite A — onboarding canvas", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/members/duplicate-check", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ blocked: false })
      });
    });
    await page.route("**/api/coaches", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: 1, full_name: "Coach Demo", login_username: "coachdemo", active: true }
        ])
      });
    });
    await page.route("**/api/course-categories**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 2, name: "普拉提 Pilates", is_active: true }])
      });
    });
  });

  async function reachSignatureStep(page: import("@playwright/test").Page) {
    const uniq = String(Date.now()).slice(-6);
    await page.goto("/register");
    await page.locator('input[name="full_name"]').fill("Loop Canvas User");
    await page.locator('input[name="hkid"]').fill(`L${uniq.slice(-4)}`);
    await page.getByPlaceholder("12345678").fill(String(90000000 + Number(uniq.slice(-5))));
    await page.locator('input[type="date"]').fill("1990-03-01");
    await page.locator('input[name="emergency_contact_name"]').fill("EC");
    await page.getByPlaceholder("87654321").fill(String(60000000 + Number(uniq.slice(-5))));

    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.getByText("醫生曾說你有心臟問題")).toBeVisible();
    await page.getByRole("button", { name: "下一步" }).click();
    await expect(page.locator("[data-cooling-copy]")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("checkbox", { name: /冷靜期/ }).check();
    await page.getByRole("checkbox", { name: /免責/ }).check();
    await page.locator("select").first().selectOption("coachdemo");
    await page.locator("select").nth(1).selectOption("2");
  }

  test("canvas strokes survive viewport resize until 清除", async ({ page }) => {
    await reachSignatureStep(page);
    await page.getByLabel("電子簽署手寫區").waitFor();
    await page.waitForFunction(() => typeof (window as unknown as { __zomateSeedSignature?: () => void }).__zomateSeedSignature === "function");
    await page.evaluate(() => {
      const seed = (window as unknown as { __zomateSeedSignature?: () => void }).__zomateSeedSignature;
      if (!seed) throw new Error("__zomateSeedSignature unavailable");
      seed();
    });
    await expect(page.locator('[data-signature-has-stroke="true"]')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    await expect(page.locator('[data-signature-has-stroke="true"]')).toBeVisible();

    await page.getByRole("button", { name: "清除" }).click();
    await expect(page.locator('[data-signature-has-stroke="false"]')).toBeVisible();
  });

  test("blank signature submit shows modal and red hint", async ({ page }) => {
    await reachSignatureStep(page);

    const submit = page.getByRole("button", { name: "提交登記" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page.getByText("缺少電子簽署")).toBeVisible();
    await expect(page.getByText("請用手指或滑鼠簽署；系統只儲存簽名圖片 URL。")).toHaveClass(/text-red-500/);
  });
});
