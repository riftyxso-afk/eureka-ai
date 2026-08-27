import type { Config } from "tailwindcss";

// Warna clay memakai CSS variable berbasis kanal RGB (format "R G B")
// supaya modifier opacity (/10, /40, dst.) tetap bekerja dan mode gelap
// cukup menukar nilai variabel di app/globals.css (.dark) — tanpa override
// per-kelas. Lihat blok :root / .dark di app/globals.css.
const config: Config = {
  // Mode gelap dikendalikan class `.dark` di <html> (lihat context/ThemeContext.tsx).
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Self-hosted via next/font (lihat app/layout.tsx) — tanpa request
        // render-blocking ke Google Fonts di runtime.
        sans: ["var(--font-nunito)", "Nunito", "sans-serif"],
        display: ["var(--font-nunito)", "Nunito", "sans-serif"],
      },
      colors: {
        clay: {
          primary: "rgb(var(--clay-primary) / <alpha-value>)",
          secondary: "rgb(var(--clay-secondary) / <alpha-value>)",
          success: "rgb(var(--clay-success) / <alpha-value>)",
          dark: "rgb(var(--clay-dark) / <alpha-value>)",
          muted: "rgb(var(--clay-muted) / <alpha-value>)",
          beige: "rgb(var(--clay-beige) / <alpha-value>)",
          cream: "rgb(var(--clay-cream) / <alpha-value>)",
          shadow: "rgb(var(--clay-shadow) / <alpha-value>)",
          shadowDark: "rgb(var(--clay-shadow-dark) / <alpha-value>)",
          inputBg: "rgb(var(--clay-input-bg) / <alpha-value>)",
          borderLight: "rgb(var(--clay-border-light) / <alpha-value>)",
          borderShadow: "rgb(var(--clay-border-shadow) / <alpha-value>)",
        },
        // Palet aksen mata pelajaran — nilai kanal di app/globals.css
        // (:root = tier terang, .dark = tier gelap), sumber kebenaran
        // hex di lib/palette.ts. Pemakaian: bg-subject-sky/15, text-subject-sky.
        subject: {
          sky: "rgb(var(--subject-sky) / <alpha-value>)",
          violet: "rgb(var(--subject-violet) / <alpha-value>)",
          rose: "rgb(var(--subject-rose) / <alpha-value>)",
          amber: "rgb(var(--subject-amber) / <alpha-value>)",
          emerald: "rgb(var(--subject-emerald) / <alpha-value>)",
          fuchsia: "rgb(var(--subject-fuchsia) / <alpha-value>)",
          blue: "rgb(var(--subject-blue) / <alpha-value>)",
          orange: "rgb(var(--subject-orange) / <alpha-value>)",
          teal: "rgb(var(--subject-teal) / <alpha-value>)",
          red: "rgb(var(--subject-red) / <alpha-value>)",
          lime: "rgb(var(--subject-lime) / <alpha-value>)",
          indigo: "rgb(var(--subject-indigo) / <alpha-value>)",
        },
      },
      boxShadow: {
        // Claymorphism Core Rules (SOLID SHADOWS, NO BLUR) — semua warna
        // mengikuti variabel tema sehingga bayangan ikut gelap otomatis.
        clay: "0 10px 0 rgb(var(--clay-shadow)), inset 0 -4px 0 rgb(var(--clay-inset-mid))",
        "clay-sm":
          "0 6px 0 rgb(var(--clay-shadow)), inset 0 -3px 0 rgb(var(--clay-inset-low))",
        "clay-lg":
          "0 14px 0 rgb(var(--clay-shadow-dark)), inset 0 -6px 0 rgb(var(--clay-inset-low))",
        "clay-btn":
          "0 8px 0 rgb(var(--clay-btn-shadow)), inset 0 -2px 0 rgb(var(--clay-btn-highlight))",
        "clay-btn-hover":
          "0 10px 0 rgb(var(--clay-btn-shadow)), inset 0 -2px 0 rgb(var(--clay-btn-highlight))",
        "clay-btn-active":
          "0 4px 0 rgb(var(--clay-btn-shadow)), inset 0 -2px 0 rgb(var(--clay-btn-highlight))",
        "clay-inset": "inset 0 4px 8px rgba(0,0,0,0.1)",
        "clay-thumb": "0 4px 0 rgb(var(--clay-thumb))",
      },
      borderRadius: {
        // SKALA RADIUS RESMI (satu-satunya nilai yang boleh dipakai):
        //  clay      32px → kartu halaman, panel besar, shell pop-up/modal
        //  clay-md   24px → kartu kecil, panel dalam modal, input/textarea
        //  clay-sm   16px → kartu mini, kotak info/badge besar (jarang)
        //  clay-full 50px → tombol pill & elemen kapsul
        //  rounded-full     → avatar, dot, badge kecil membulat penuh
        // Mikro (4–12px, kelas `rounded`/`rounded-lg`) hanya untuk elemen
        // inline: chip kode, ekor chat bubble, thumbnail mini.
        clay: "32px",
        "clay-md": "24px",
        "clay-sm": "16px",
        "clay-full": "50px",
      },
      borderWidth: {
        "3": "3px",
      },
      maxWidth: {
        clay: "988px",
      },
    },
  },
  plugins: [],
};
export default config;
