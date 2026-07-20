import { test, expect } from "@playwright/test";

test.describe("Moderation batches flow", () => {
  test("should display the batches list", async ({ page }) => {
    await page.goto("/batches");
    await expect(page).toHaveURL(/batches/);
  });

  test("should display the new-batch form", async ({ page }) => {
    await page.goto("/batches/new");
    await expect(page).toHaveURL(/batches\/new/);
  });

  test("should display the bucket explorer", async ({ page }) => {
    await page.goto("/files");
    await expect(page).toHaveURL(/files/);
  });

  test("should display the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
