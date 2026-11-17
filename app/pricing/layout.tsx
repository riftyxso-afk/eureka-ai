import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";
import { TIER_PRICES } from "@/lib/paymentPricing";

export async function generateMetadata(): Promise<Metadata> {
  const price = `Rp ${TIER_PRICES.normal.toLocaleString("id-ID")}`;
  return pageMetadata({
    path: "/pricing",
    title: {
      id: `Harga Eureka AI Pro — ${price} untuk 30 hari`,
      en: `Eureka AI Pro Pricing — ${price} for 30 days`,
    },
    description: {
      id: `Akun baru otomatis mendapat 28 hari Eureka Pro gratis. Setelahnya, ${price} untuk 30 hari dengan pembayaran sekali dan tanpa perpanjangan otomatis.`,
      en: `New accounts automatically get 28 days of Eureka Pro for free. After that, ${price} covers 30 days with a one-time payment and no auto-renewal.`,
    },
    ogTitle: {
      id: "Harga Eureka AI Pro",
      en: "Eureka AI Pro Pricing",
    },
  });
}

export default function PricingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
import "../dashboard/more-pages.css";
