import type { MetadataRoute } from "next";

const BASE = "https://club.bigmarkt.co";

const routes = ["/", "/about", "/chapters", "/tracks", "/mentorship", "/join"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: `${BASE}${path}`,
  }));
}
