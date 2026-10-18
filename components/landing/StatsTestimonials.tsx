"use client";

import { Users, FileText, Star, GraduationCap } from "lucide-react";
import { useI18n } from "@/context/LocaleContext";
import { ReviewSection, type ReviewData } from "@/components/landing/ReviewSection";

interface StatsTestimonialsProps {
  reviewData: ReviewData | null;
  loggedIn: boolean;
  onRefresh: () => void;
}

export function StatsTestimonials({
  reviewData,
  loggedIn,
  onRefresh,
}: StatsTestimonialsProps) {
  const { dict } = useI18n();

  const statIcons = [
    <Users key="users" size={24} className="text-[#7C3AED]" />,
    <FileText key="file" size={24} className="text-blue-500" />,
    <Star key="star" size={24} className="text-amber-400 fill-amber-400" />,
    <GraduationCap key="grad" size={24} className="text-emerald-500" />,
  ];

  return (
    <section
      id="ulasan"
      aria-label="Statistik dan Ulasan"
      className="w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto flex flex-col items-center gap-12 sm:gap-16"
    >
      {/* Heading */}
      <div className="text-center max-w-3xl flex flex-col items-center gap-3">
        <span className="text-xs sm:text-sm font-bold tracking-widest text-[#7C3AED] dark:text-violet-400 uppercase">
          {dict.socialProof.eyebrow}
        </span>
        <h2 className="font-extrabold text-3xl sm:text-5xl text-[#1A1A2E] dark:text-white tracking-tight leading-tight">
          {dict.socialProof.title}
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-xl">
          {dict.socialProof.subtitle}
        </p>
      </div>

      {/* 4 Stat KPI Cards */}
      <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {dict.socialProof.stats.map((stat, i) => (
          <div
            key={stat.label}
            className="anim-hover-lift rounded-2xl bg-white dark:bg-[#161528] border border-gray-200/80 dark:border-white/10 p-6 sm:p-8 flex flex-col items-center text-center gap-3 shadow-xs"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center">
              {statIcons[i % statIcons.length]}
            </div>
            <span className="font-extrabold text-2xl sm:text-4xl text-[#1A1A2E] dark:text-white tracking-tight">
              {stat.value}
            </span>
            <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* 4 Verified Testimonials */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {dict.socialProof.testimonials.map((t) => (
          <div
            key={t.name}
            className="anim-hover-lift rounded-2xl bg-white dark:bg-[#161528] border border-gray-200/80 dark:border-white/10 p-6 flex flex-col justify-between gap-4 shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950/80 text-[#7C3AED] dark:text-violet-300 font-bold text-sm flex items-center justify-center flex-shrink-0">
                {t.initial}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold text-sm text-[#1A1A2E] dark:text-white leading-tight">
                  {t.name}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                  {t.role}
                </span>
                <div className="flex items-center gap-0.5 mt-1" aria-label="5 bintang">
                  {[...Array(5)].map((_, idx) => (
                    <Star
                      key={idx}
                      size={12}
                      className="fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-left italic">
              “{t.quote}”
            </p>
          </div>
        ))}
      </div>

      {/* Real Dynamic Reviews from Database */}
      <div className="w-full">
        <ReviewSection
          data={reviewData}
          loggedIn={loggedIn}
          onRefresh={onRefresh}
        />
      </div>
    </section>
  );
}
