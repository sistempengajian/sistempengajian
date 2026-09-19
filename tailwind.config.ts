import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-role-santri",
    "bg-role-pengajar",
    "bg-role-orang-tua",
    "bg-role-pj",
    "bg-role-admin",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          // Primary Mint Sage
          mint: {
            50: "#ECFDF5",
            100: "#D1FAE5",
            200: "#A7F3D0",
            300: "#6EE7B7",
            400: "#34D399",
            500: "#10B981",
            600: "#059669",
            700: "#047857",
            800: "#065F46",
            900: "#064E3B",
          },
          // Background Vanilla Cream
          cream: {
            50: "#FEFCE8",
            100: "#FEF3C7",
            200: "#FDE68A",
            300: "#FCD34D",
          },
          // Secondary Periwinkle Blue
          periwinkle: {
            50: "#EEF2FF",
            100: "#E0E7FF",
            200: "#C7D2FE",
            300: "#A5B4FC",
            400: "#818CF8",
            500: "#6366F1",
            600: "#4F46E5",
          },
          // Coral Red for Calendar Dot Badge & Alerts
          coral: {
            50: "#FFF1F2",
            100: "#FFE4E6",
            200: "#FECDD3",
            300: "#FDA4AF",
            400: "#FB7185",
            500: "#F43F5E",
            600: "#E11D48",
          },
          // Butter Amber for Gamification Stars & Badges
          amber: {
            50: "#FFFBEB",
            100: "#FEF3C7",
            200: "#FDE68A",
            300: "#FCD34D",
            400: "#FBBF24",
            500: "#F59E0B",
            600: "#D97706",
          },
          // Slate Charcoal for high-readability text
          slate: {
            50: "#F8FAFC",
            100: "#F1F5F9",
            200: "#E2E8F0",
            300: "#CBD5E1",
            400: "#94A3B8",
            500: "#64748B",
            600: "#475569",
            700: "#334155",
            800: "#1E293B",
            900: "#0F172A",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "Traditional Arabic", "serif"],
      },
      boxShadow: {
        pastel: "0 4px 20px -2px rgba(16, 185, 129, 0.08)",
        "pastel-lg": "0 10px 25px -3px rgba(16, 185, 129, 0.12)",
        "card-soft": "0 2px 12px rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
