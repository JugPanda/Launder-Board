import { expect, test, type Page } from "@playwright/test";

const routes = [
  "/",
  "/dashboard",
  "/activity",
  "/activity/new",
  "/activity/import",
  "/search",
  "/friends",
  "/competitions/fall-weekly-quest",
  "/settings/privacy",
  "/leaderboards/fall-weekly-quest",
  "/p/maya-quest",
] as const;

const syntheticDemoRoutes = new Set([
  "/dashboard",
  "/activity",
  "/search",
  "/friends",
  "/competitions/fall-weekly-quest",
  "/settings/privacy",
  "/leaderboards/fall-weekly-quest",
  "/p/maya-quest",
]);

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

test.describe("production mobile demo gate", () => {
  test.skip(({ isMobile }) => !isMobile, "This gate runs with the mobile project only.");

  for (const route of routes) {
    test(`${route} renders cleanly at 375px`, async ({ page }) => {
      const errors = collectPageErrors(page);
      const response = await page.goto(route, { waitUntil: "networkidle" });

      expect(response, `No navigation response for ${route}`).not.toBeNull();
      expect(response?.status(), `Unexpected status for ${route}`).toBe(200);
      expect(new URL(page.url()).pathname).toBe(route);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await page.locator("h1").count()).toBeGreaterThan(0);

      if (syntheticDemoRoutes.has(route)) {
        await expect(page.getByText("Synthetic demo", { exact: true })).toBeVisible();
      }

      await page.evaluate(() => document.fonts.ready);
      const viewport = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(viewport.innerWidth).toBe(375);
      expect(viewport.scrollWidth, `Horizontal overflow on ${route}: ${JSON.stringify(viewport)}`).toBeLessThanOrEqual(
        viewport.clientWidth,
      );
      expect(errors).toEqual([]);
    });
  }

  test("landing CTA enters the labeled synthetic dashboard", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/");
    await page.getByRole("link", { name: /view synthetic demo/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: /maya's quest/i })).toBeVisible();
    await expect(page.getByText("Synthetic demo", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("friend encouragement is preset-only and starts a labeled local cooldown", async ({ page }) => {
    const errors = collectPageErrors(page);
    const apiWrites: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() !== "GET") {
        apiWrites.push(`${request.method()} ${request.url()}`);
      }
    });
    await page.goto("/friends");

    const preset = page.getByRole("combobox", { name: /encouragement for noah r\./i });
    await expect(preset).toHaveValue("laundry_quest");
    await preset.selectOption("hall_point");
    await page.getByRole("button", { name: /send preset encouragement/i }).click();

    await expect(page.getByRole("button", { name: /72-hour cooldown active/i })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText(/demo only—nothing was saved/i);
    await expect(page.getByText(/available again after/i)).toBeVisible();
    expect(apiWrites).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("hall typo search stays local and labels its synthetic result", async ({ page }) => {
    const errors = collectPageErrors(page);
    const apiRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/")) apiRequests.push(`${request.method()} ${request.url()}`);
    });
    await page.goto("/competitions/fall-weekly-quest");

    await page.getByRole("searchbox", { name: /search synthetic halls/i }).fill("Mapel");
    const results = page.getByRole("list", { name: /synthetic search results/i });
    await expect(results).toContainText("Maple Hall");
    await expect(results).toContainText("Synthetic competition hall");
    await expect(results).toContainText("Matched despite 1 typo");
    expect(apiRequests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("privacy preview starts off and withdraws immediately without an API write", async ({ page }) => {
    const errors = collectPageErrors(page);
    const apiWrites: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() !== "GET") {
        apiWrites.push(`${request.method()} ${request.url()}`);
      }
    });
    await page.goto("/settings/privacy");

    const publicStats = page.getByRole("switch", { name: /public participant statistics/i });
    await expect(publicStats).toHaveAttribute("aria-checked", "false");
    await publicStats.click();
    await expect(page.getByText("Public preview is on", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /withdraw public view now/i }).click();

    await expect(publicStats).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("status")).toContainText(/withdrawn immediately.*browser-only demo.*nothing was sent or saved/i);
    expect(apiWrites).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("activity history exposes honest source labels", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/activity");

    await expect(page.getByText("Simulated CSC-format demo", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Self-reported", { exact: true })).toHaveCount(2);
    await expect(page.getByText(/none is verified by a laundry provider/i)).toBeVisible();
    expect(errors).toEqual([]);
  });
});