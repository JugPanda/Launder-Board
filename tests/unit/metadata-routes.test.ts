import { expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

const origin = "https://laundrostat.vercel.app";

it("publishes crawl rules without exposing private or API surfaces", () => {
  expect(robots()).toEqual({
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/activity",
        "/api/",
        "/competitions/",
        "/dashboard",
        "/friends",
        "/onboarding",
        "/search",
        "/settings/",
        "/sign-in",
        "/sign-out",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  });
});

it("lists only the intentionally public product pages", () => {
  expect(sitemap().map(({ url }) => url)).toEqual([
    origin,
    `${origin}/demo`,
    `${origin}/purdue/halls`,
  ]);
});
