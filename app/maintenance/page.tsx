import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pemeliharaan — Eureka.AI",
  description: "Eureka.AI sedang dalam pemeliharaan. Kami akan segera kembali.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-clay-surface via-clay-bg to-clay-surface dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 px-4">
      {/* Sticker holo */}
      <div className="mb-8">
        <img
          src="/holo-sticker.gif"
          alt="Eureka.AI"
          className="w-40 h-40 md:w-52 md:h-52"
          style={{ mixBlendMode: "screen" }}
        />
      </div>

      {/* Card utama */}
      <div className="clay-card rounded-3xl p-8 md:p-12 max-w-lg w-full text-center">
        {/* Chip status */}
        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-semibold rounded-full px-3 py-1 mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          Pemeliharaan
        </span>

        <h1 className="text-3xl md:text-4xl font-bold text-clay-text dark:text-white mb-3">
          Sedang Pemeliharaan 🔧
        </h1>

        <p className="text-clay-text-secondary dark:text-gray-400 text-base md:text-lg mb-6 leading-relaxed">
          Kami sedang melakukan pemeliharaan sistem untuk memberikan pengalaman
          yang lebih baik. Eureka.AI akan segera kembali!
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-clay-text-secondary dark:text-gray-400 bg-clay-surface dark:bg-gray-800 rounded-xl p-3">
            <span className="text-lg">⏰</span>
            <span>Diperkirakan selesai dalam <strong className="text-clay-text dark:text-white">1–2 jam</strong></span>
          </div>
          <div className="flex items-center gap-3 text-sm text-clay-text-secondary dark:text-gray-400 bg-clay-surface dark:bg-gray-800 rounded-xl p-3">
            <span className="text-lg">📧</span>
            <span>Update terbaru di <strong className="text-clay-text dark:text-white">@EurekaAI</strong></span>
          </div>
        </div>
      </div>

      {/* Footer kecil */}
      <p className="mt-8 text-xs text-clay-text-secondary/50 dark:text-gray-600">
        © {new Date().getFullYear()} Eureka.AI — Kami kembali sebentar lagi 🚀
      </p>
    </div>
  );
}
