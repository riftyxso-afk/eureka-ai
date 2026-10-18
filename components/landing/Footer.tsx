"use client";

import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/context/LocaleContext";

export function Footer() {
  const { dict } = useI18n();

  return (
    <footer
      aria-label="Footer"
      className="w-full bg-[#FCFCFD] dark:bg-[#0B0A16] border-t border-gray-200 dark:border-white/10 pt-16 pb-12 px-4 sm:px-6 lg:px-8 text-gray-600 dark:text-gray-400 text-sm transition-colors"
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-12">
        {/* Top 4-Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Eureka AI"
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
              <span className="font-bold text-lg text-[#1A1A2E] dark:text-white">
                eureka<span className="text-[#7C3AED]">.ai</span>
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs">
              {dict.footer.tagline}
            </p>
          </div>

          {/* Column Produk */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#1A1A2E] dark:text-white">
              {dict.footer.colProduct}
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a
                  href="#fitur"
                  className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
                >
                  {dict.footer.fitur}
                </a>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
                >
                  {dict.footer.harga}
                </Link>
              </li>
              <li>
                <Link
                  href="/extension"
                  className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
                >
                  {dict.footer.ekstensi}
                </Link>
              </li>
              <li>
                <Link
                  href="/join"
                  className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
                >
                  Program Beta
                </Link>
              </li>
            </ul>
          </div>

          {/* Column Legal */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#1A1A2E] dark:text-white">
              {dict.footer.colLegal}
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a
                  href="#faq"
                  className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
                >
                  {dict.nav.faq}
                </a>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
                >
                  {dict.footer.privasi}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
                >
                  {dict.footer.syarat}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column Kontak */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#1A1A2E] dark:text-white">
              {dict.footer.colContact}
            </h4>
            <div className="space-y-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <p>
                <a
                  href={`mailto:${dict.footer.contactEmail}`}
                  className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
                >
                  {dict.footer.contactEmail}
                </a>
              </p>
              <p>{dict.footer.contactLocation}</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gray-200 dark:bg-white/10" />

        {/* Bottom Bar: Copyright & Product Hunt */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center sm:text-left">
            {dict.footer.copyright}
          </p>

          {/* Badge Featured Product Hunt */}
          <a
            href="https://www.producthunt.com/products/eureka-ai-socratic-ai-study-tutor?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-eureka-ai-socratic-ai-study-tutor"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Eureka.AI — Socratic AI Study Tutor - AI Socratic tutor that turns videos & PDFs into study notes | Product Hunt"
              width={220}
              height={48}
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1225609&theme=light&t=1787036631696"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
