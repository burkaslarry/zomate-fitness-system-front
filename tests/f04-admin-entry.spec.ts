import { expect, test } from "@playwright/test";

test.describe("F04/F015 admin entry smoke", () => {
  test("login page shows staff credentials hint and inputs", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "後台登入" })).toBeVisible();
    await expect(page.getByText("masterzoe / 12345678")).toBeVisible();
    await expect(page.getByLabel("帳號")).toBeVisible();
    await expect(page.getByLabel("密碼")).toBeVisible();
    await expect(page.getByRole("button", { name: "登入" })).toBeVisible();
  });

  test("protected finance route redirects unauthenticated user", async ({ page }) => {
    await page.goto("/admin/finance/sales");
    await expect(page).toHaveURL(/\/login/);
  });
});
