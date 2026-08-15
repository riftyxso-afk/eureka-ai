import type { MetadataRoute } from "next";

const SITE_URL = "https://www.eureka-ai.web.id";

/**
 * robots.txt — izinkan crawler mengindeks halaman publik Eureka.AI
 * dan arahkan ke sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
