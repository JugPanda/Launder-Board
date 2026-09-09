import type { MetadataRoute } from "next";

const origin = "https://laundrostat.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: origin, changeFrequency: "monthly", priority: 1 },
    { url: `${origin}/demo`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${origin}/purdue/halls`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
