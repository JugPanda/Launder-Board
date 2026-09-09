import { expect, test } from "@playwright/test";

test("landing page explains the weekly cap", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /win your hall's weekly laundry challenge/i,
    }),
  ).toBeVisible();
  await expect(page.getByText(/one participation credit per week/i)).toBeVisible();
});
