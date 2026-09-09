import { expect, test } from "@playwright/test";

test("landing page presents all five concepts and enters the sign-in-free demo", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Laundry. With a competitive streak./);
  await expect(page.getByRole("heading", { name: "One routine. Five ways to play." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fair by design." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("link", { name: /view synthetic demo/i }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("Synthetic demo", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("1 of 1 weekly credits");
  expect(errors).toEqual([]);
});
