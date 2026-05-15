/**
 * [F006][S005]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: (see Logic)
 * Logic: Playwright feature specs for smoke paths.
 */

import { expect, test } from "@playwright/test";

test.describe("F02 trial / renewal surfaces", () => {
  test("trial-class form blocks submit when no student selected", async ({ page }) => {
    await page.goto("/trial-class");

    await expect(page.getByRole("heading", { name: "試堂 / 加堂" })).toBeVisible();
    await page.getByRole("button", { name: "提交" }).click();
    await expect(page.getByText(/請先選擇學生|請先輸入電話/)).toBeVisible();
  });

  test("student trial page shows required core inputs", async ({ page }) => {
    await page.goto("/student/trial");

    await expect(page.getByRole("heading", { name: "試堂／加堂" })).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toHaveAttribute("required", "");
    await expect(page.locator('input[name="credits"]')).toHaveAttribute("min", "1");
  });

  test("renewal page has phone lookup entrance", async ({ page }) => {
    await page.goto("/renewal");

    await expect(page.getByRole("heading", { name: "續會 Renewal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "搜尋" })).toBeVisible();
  });
});
