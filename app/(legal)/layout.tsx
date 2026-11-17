import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main lang="id" className="min-h-dvh bg-clay-cream text-clay-dark">
      <div className="mx-auto max-w-3xl px-6 pb-16 pt-8 sm:px-10 sm:pt-12">
        <nav aria-label="Navigasi Eureka" className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-clay-dark/15 pb-4 text-sm">
          <a href="/id" className="me-auto text-xl font-extrabold">Eureka.AI</a>
          <a href="/privacy" className="underline underline-offset-4">Kebijakan Privasi</a>
          <a href="/terms" className="underline underline-offset-4">Syarat Layanan</a>
        </nav>
        <article className="space-y-7 break-words text-base leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-5">
          {children}
        </article>
      </div>
    </main>
  );
}
