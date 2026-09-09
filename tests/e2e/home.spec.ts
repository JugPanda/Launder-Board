import { expect, test } from "@playwright/test";

test("landing page enters the sign-in-free Clean-O-Meter demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Laundry. With a competitive streak./);
  await page.getByRole("link", { name: /view synthetic demo/i }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("Synthetic demo", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("1 of 1 weekly credits");
});
