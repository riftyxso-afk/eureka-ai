"use client";

import { useCallback, useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/auth";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { useI18n } from "@/context/LocaleContext";
import { AnnouncementBar } from "@/components/landing/AnnouncementBar";
import { PillNavbar } from "@/components/landing/PillNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { StatsTestimonials } from "@/components/landing/StatsTestimonials";
import { FeaturesBento } from "@/components/landing/FeaturesBento";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { FinalCta } from "@/components/landing/FinalCta";
import { SupportedBy } from "@/components/landing/SupportedBy";
import { Footer } from "@/components/landing/Footer";
import type { ReviewData } from "@/components/landing/ReviewSection";

const SITE_URL = "https://www.eureka-ai.web.id";

export default function LandingPage() {
  const { locale, dict } = useI18n();
  const [loggedIn, setLoggedIn] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  const loadReviews = useCallback(async () => {
    const userId = getUserId();
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    try {
      const res = await apiFetch(`/api/reviews${qs}`);
      if (res.ok) setReviewData((await res.json()) as ReviewData);
    } catch {
      // biarkan null — seksi ulasan tidak tampil jika error
    }
  }, []);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    loadReviews();
  }, [loadReviews]);

  // Schema JSON-LD lengkap untuk SEO & AI Answer Engines (Perplexity, GPTBot, Gemini)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Eureka.AI",
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        description: dict.hero.subtitle,
        inLanguage: locale,
      },
      {
        "@type": "WebSite",
        name: "Eureka.AI",
        url: SITE_URL,
        inLanguage: locale,
      },
      {
        "@type": "SoftwareApplication",
        name: "Eureka.AI",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        inLanguage: locale,
        datePublished: "2026-08-15",
        dateModified: "2026-08-15",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "IDR",
          lowPrice: "0",
          highPrice: "59000",
        },
        description: dict.hero.subtitle,
        ...(reviewData?.stats && reviewData.stats.count > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: String(reviewData.stats.average ?? 0),
                bestRating: "5",
                worstRating: "1",
                reviewCount: reviewData.stats.count,
              },
              review: (reviewData.reviews ?? []).slice(0, 3).map((r) => ({
                "@type": "Review",
                author: { "@type": "Person", name: r.authorName },
                datePublished: r.createdAt.slice(0, 10),
                reviewRating: {
                  "@type": "Rating",
                  ratingValue: String(r.rating),
                  bestRating: "5",
                },
                ...(r.title ? { name: r.title } : {}),
                ...(r.content ? { reviewBody: r.content } : {}),
              })),
            }
          : {}),
      },
      {
        "@type": "FAQPage",
        mainEntity: dict.faq.items.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const ctaHref = loggedIn ? "/dashboard" : "/register";

  return (
    <div className="k-landing min-h-screen text-[#1A1A2E] dark:text-[#F3F4F6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AnnouncementBar />
      <PillNavbar loggedIn={loggedIn} />
      <main>
        <HeroSection loggedIn={loggedIn} ctaHref={ctaHref} />
        <TrustStrip />
        <StatsTestimonials
          reviewData={reviewData}
          loggedIn={loggedIn}
          onRefresh={loadReviews}
        />
        <FeaturesBento ctaHref={ctaHref} />
        <FaqAccordion />
        <FinalCta loggedIn={loggedIn} ctaHref={ctaHref} />
        <SupportedBy />
      </main>
      <Footer />
    </div>
  );
}
