import type { MetadataRoute } from "next";

const BASE = "https://www.bigmarkt.co";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { path: "/", changeFrequency: "weekly" as const, priority: 1.0 },
    { path: "/protocol", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/ecosystem", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/security", changeFrequency: "yearly" as const, priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
    { path: "/blog", changeFrequency: "weekly" as const, priority: 0.8 },
  ].map(({ path, changeFrequency, priority }) => ({
    url: `${BASE}${path}`,
    changeFrequency,
    priority,
  }));
}
