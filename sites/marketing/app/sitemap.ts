import type { MetadataRoute } from "next";

const BASE = "https://www.bigmarkt.co";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "/",
    "/protocol",
    "/ecosystem",
    "/security",
    "/privacy",
  ].map((path) => ({
    url: `${BASE}${path}`,
  }));
}
