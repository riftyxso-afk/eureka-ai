import type { MetadataRoute } from "next";

const SITE_URL = "https://www.eureka-ai.web.id";

/**
 * Sitemap halaman publik Eureka.AI — URL kanonik + hreflang (id/en)
 * untuk mesin pencari. Versi /en/... menandakan halaman bahasa Inggris.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Halaman publik yang punya versi id & en (prefix /id dan /en).
  const pages: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/pricing", priority: 0.9, freq: "monthly" },
    { path: "/register", priority: 0.8, freq: "monthly" },
    { path: "/login", priority: 0.5, freq: "monthly" },
    { path: "/join", priority: 0.6, freq: "monthly" },
    { path: "/launch", priority: 0.8, freq: "monthly" },
  ];

  return pages.flatMap((p) => {
    const entry = (locale: "id" | "en") => {
      const base = p.path === "/" ? "" : p.path;
      return `${SITE_URL}/${locale}${base}`;
    };
    return [
      {
        url: entry("id"),
        lastModified: now,
        changeFrequency: p.freq,
        priority: p.priority,
        alternates: {
          languages: {
            id: entry("id"),
            en: entry("en"),
            "x-default": entry("id"),
          },
        },
      },
      {
        url: entry("en"),
        lastModified: now,
        changeFrequency: p.freq,
        priority: p.priority,
        alternates: {
          languages: {
            id: entry("id"),
            en: entry("en"),
            "x-default": entry("id"),
          },
        },
      },
    ];
  });
}
