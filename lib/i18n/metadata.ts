import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  alternatesFor,
  isLocale,
  ogLocale,
  type Locale,
} from "@/lib/i18n";

const SITE_URL = "https://www.eureka-ai.web.id";

/** Baca locale aktif dari header x-locale (diset middleware). */
export async function getLocale(): Promise<Locale> {
  try {
    const h = await headers();
    const raw = h.get("x-locale");
    return raw && isLocale(raw) ? raw : "id";
  } catch {
    return "id";
  }
}

interface PageMeta {
  path: string;
  /** title per locale: { id: "...", en: "..." } */
  title: Record<Locale, string>;
  /** description per locale */
  description: Record<Locale, string>;
  /** ogTitle singkat per locale (opsional) */
  ogTitle?: Record<Locale, string>;
  robotsNoindex?: boolean;
}

/**
 * Susun metadata halaman publik per locale — title/description ikut bahasa,
 * canonical & hreflang (alternates.languages) menunjuk URL ber-prefix locale.
 */
export async function pageMetadata(m: PageMeta): Promise<Metadata> {
  const locale = await getLocale();
  const title = m.title[locale] ?? m.title.id;
  const description = m.description[locale] ?? m.description.id;
  const ogTitle = m.ogTitle?.[locale] ?? m.ogTitle?.id ?? title;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: alternatesFor(locale, m.path),
    ...(m.robotsNoindex
      ? { robots: { index: false, follow: false } }
      : {}),
    openGraph: {
      type: "website",
      locale: ogLocale(locale),
      siteName: "Eureka.AI",
      title: ogTitle,
      description,
      url: `${SITE_URL}${alternatesFor(locale, m.path).canonical}`,
      images: [
        {
          url: "/banner.png",
          width: 1200,
          height: 800,
          alt: ogTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: ["/banner.png"],
    },
  };
}
