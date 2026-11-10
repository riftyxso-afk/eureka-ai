import type { MetadataRoute } from "next";

/**
 * PWA manifest — membuat situs bisa "Add to Home Screen" (iOS) & installable
 * (Android Chrome). Wajib agar notifikasi Web Push & Notification API bisa
 * muncul di HP, terutama iPhone (iOS 16.4+ hanya mengizinkan notifikasi web
 * untuk PWA yang terpasang).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eureka.AI — Bukan sekadar jawaban, tapi momen Eureka!",
    short_name: "Eureka",
    id: "/",
    description:
      "AI Tutor Socratic untuk semua pelajar Indonesia. Bukan sekadar memberi jawaban, tapi membimbingmu menemukan momen Eureka!",
    lang: "id",
    start_url: "/id/dashboard-v2",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#7C3AED",
    icons: [
      {
        src: "/icons/momo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/momo-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/momo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
