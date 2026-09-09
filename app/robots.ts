import type { MetadataRoute } from "next";

const origin = "https://laundrostat.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
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
  };
}
