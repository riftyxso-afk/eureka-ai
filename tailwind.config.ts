import type { Config } from "tailwindcss";

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
        sans: ["Nunito", "sans-serif"],
        display: ["'Fredoka One'", "Poppins", "sans-serif"],
      },
      colors: {
        clay: {
          primary: "#8B5CF6", // Soft Purple (Brand)
          secondary: "#F59E0B", // Warm Amber (Accent)
          success: "#10B981", // Soft Emerald (Eureka!)
          dark: "#2D2A24", // Dark Chocolate Text
          muted: "#8C857C", // Muted Text
          beige: "#F9F3EC", // Canvas Background
          cream: "#FFFFFF", // Card Base
          shadow: "#D1C4B4", // Solid Drop Shadow
          shadowDark: "#B0A898", // Pressed State Shadow
          inputBg: "#EFE8E0", // Depressed Input Area
          borderLight: "#C4B5FD", // Top/Left Highlight Border
          borderShadow: "#5B21B6", // Bottom/Right Shadow Border
        },
      },
      boxShadow: {
        // Claymorphism Core Rules (SOLID SHADOWS, NO BLUR)
        clay: "0 10px 0 #D1C4B4, inset 0 -4px 0 #E5E7EB",
        "clay-sm": "0 6px 0 #D1C4B4, inset 0 -3px 0 #F3F4F6",
        "clay-lg": "0 14px 0 #B0A898, inset 0 -6px 0 #F3F4F6",
        "clay-btn": "0 8px 0 #5B21B6, inset 0 -2px 0 #C4B5FD",
        "clay-btn-hover": "0 10px 0 #5B21B6, inset 0 -2px 0 #C4B5FD",
        "clay-btn-active": "0 4px 0 #5B21B6, inset 0 -2px 0 #C4B5FD",
        "clay-inset": "inset 0 4px 8px rgba(0,0,0,0.1)",
        "clay-thumb": "0 4px 0 #B45309",
      },
      borderRadius: {
        clay: "32px",
        "clay-md": "24px",
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
