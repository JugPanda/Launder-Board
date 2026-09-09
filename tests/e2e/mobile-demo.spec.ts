import { expect, test } from "@playwright/test";

test("guest demo is responsive and contains no weekly-cap game", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const response = await page.goto("/demo", { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  await expect(page.getByText("Synthetic demo", { exact: true })).toBeVisible();
  const tabs = page.getByRole("tab");
  for (let i = 0; i < await tabs.count(); i++) {
    await tabs.nth(i).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/1 of 1 weekly credits|cap reached|weekly participation credit/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("guest route only opens its scoped demo session, never collects account details", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
  await page.goto("/demo");
  await expect(page.locator('input[type="password"],input[type="email"]')).toHaveCount(0);
  await expect(page.getByLabel("Synthetic profile preview")).toBeVisible();
  expect(writes.length).toBeGreaterThan(0);
  expect(writes.every(url => new URL(url).pathname === "/api/demo/session")).toBe(true);
});

test("old guest entry points route to the current product", async ({ page }) => {
  for (const route of ["/sign-in", "/dashboard", "/activity/new", "/friends", "/leaderboards/fall-weekly-quest"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/demo$/);
  }
});
