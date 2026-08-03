/**
 * [F004][S005] Export payroll CSV to docs/ for local delivery.
 * Run: E2E_BASE_URL=https://zomate-fitness-system-front.vercel.app PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test export-payroll-csv-to-docs.spec.ts
 */

import { test, expect } from "@playwright/test";
import path from "node:path";

const OUT = path.resolve(
  __dirname,
  "../../docs/coach-attendance-income-fung-lo-2026-07-01_to_2026-08-31.csv"
);

test("export payroll CSV to docs folder", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/login?logout=1");
  await page.getByLabel("帳號").fill("masterzoe");
  await page.getByLabel("密碼").fill("12345678");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await page.waitForURL("**/admin**", { timeout: 30_000 });

  await page.goto("/admin/finance/payroll");
  await expect(page.getByRole("main").getByRole("heading", { name: "教練出勤收入匯出" })).toBeVisible({
    timeout: 20_000
  });

  const coachSelect = page.locator("select").first();
  const options = coachSelect.locator("option");
  for (let i = 0; i < (await options.count()); i += 1) {
    const label = (await options.nth(i).textContent())?.trim() ?? "";
    if (/fung/i.test(label)) {
      await coachSelect.selectOption({ index: i });
      break;
    }
  }

  await page.getByLabel("開始日期").fill("2026-07-01");
  await page.getByLabel("結束日期").fill("2026-08-31");
  await page.waitForTimeout(3500);

  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: "匯出 CSV" }).click();
  const download = await downloadPromise;
  await download.saveAs(OUT);
  console.log("[F004][S005] Saved CSV:", OUT);
});
