import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/d/", "/api/", "/mes-envois"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
