/**
 * [F006][S005]
 * Feature: Shared API client (Next.js to FastAPI)
 * Step: Playwright feature specs for reg course surfaces.
 */

import { expect, test } from "@playwright/test";

test.describe("F02 reg course surfaces", () => {
  test("regCourse page has phone lookup entrance", async ({ page }) => {
    await page.goto("/regCourse");

    await expect(page.getByRole("button", { name: "搜尋" })).toBeVisible();
    await expect(page.getByPlaceholder("91234567")).toBeVisible();
  });

  test("student trial redirect page shows unified payment message", async ({ page }) => {
    await page.goto("/student/trial");

    await expect(page.getByText(/統一收錢|Payment|Receipt/i)).toBeVisible();
  });
});
