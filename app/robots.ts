import type { MetadataRoute } from "next";

const SITE_URL = "https://www.eureka-ai.web.id";

/**
 * robots.txt — izinkan crawler mesin pencari DAN bot AI generatif
 * (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, dll.) mengindeks
 * konten publik Eureka.AI, lalu arahkan ke sitemap.
 *
 * Semua aturan memblokir /api/* agar crawl budget tidak terbuang ke
 * endpoint API (semua halaman publik di-render tanpa bergantung pada
 * /api/; data pengguna diambil client-side setelah login).
 */
export default function robots(): MetadataRoute.Robots {
  const publicPages = { allow: "/", disallow: "/api/" };

  return {
    rules: [
      { userAgent: "*", ...publicPages },
      // Mesin pencari utama
      { userAgent: "Googlebot", ...publicPages },
      { userAgent: "Bingbot", ...publicPages },
      { userAgent: "Applebot", ...publicPages },
      { userAgent: "Yandex", ...publicPages },
      // Bot AI generatif / answer engines (AEO & GEO)
      { userAgent: "GPTBot", ...publicPages },
      { userAgent: "OAI-SearchBot", ...publicPages },
      { userAgent: "ChatGPT-User", ...publicPages },
      { userAgent: "ClaudeBot", ...publicPages },
      { userAgent: "Claude-Web", ...publicPages },
      { userAgent: "PerplexityBot", ...publicPages },
      { userAgent: "Google-Extended", ...publicPages },
      { userAgent: "CCBot", ...publicPages },
      { userAgent: "cohere-ai", ...publicPages },
      { userAgent: "Applebot-Extended", ...publicPages },
      { userAgent: "Meta-ExternalAgent", ...publicPages },
      { userAgent: "Bytespider", ...publicPages },
      { userAgent: "Amazonbot", ...publicPages },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
