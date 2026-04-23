import type { Config } from "tailwindcss";

// Design-system tokens are the source of truth. Legacy tokens
// (navy/accent/gray-light) are kept so existing components don't break
// mid-migration — remove them once every component has been ported.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ----- Brand: Plum (aubergine) -----
        plum: {
          50: "#F4EDF1",
          100: "#E6D3DF",
          200: "#C9A8BC",
          300: "#A67E96",
          400: "#805F74",
          500: "#5F3A53", // primary
          600: "#4B2D42",
          700: "#371F30",
          800: "#26141F",
        },
        // ----- Ink (warm near-black) -----
        ink: {
          700: "#363B4D",
          800: "#262A39",
          900: "#1A1D29",
        },
        // ----- Warm neutrals -----
        parchment: "#F6F2EC",
        oat: "#EFE9DF",
        cream: "#FBF8F3",
        stone: {
          50: "#F2EDE4",
          100: "#E6DFD3",
          200: "#D4CBBB",
          300: "#B8AE9C",
          400: "#978D7C",
          500: "#6F6759",
          600: "#524B40",
          700: "#3A342B",
        },
        // ----- Semantic -----
        success: {
          50: "#ECF1E8",
          500: "#5B7A4A",
          700: "#3F5632",
        },
        warning: {
          50: "#F7EEDC",
          500: "#C08A2E",
          700: "#855E1E",
        },
        danger: {
          50: "#F5E1DB",
          500: "#B4543A",
          700: "#7E3623",
        },
        info: {
          50: "#E7ECF0",
          500: "#4A5A70",
          700: "#2F3B4C",
        },
        // ----- Legacy aliases, re-pointed to the new design-system palette.
        // Keeping the old names means every existing `bg-navy`, `text-accent`,
        // `bg-gray-light` etc. picks up the new look with no per-file edits.
        navy: "#1A1D29",              // → ink-900 (warm near-black, was cool navy)
        accent: "#5F3A53",            // → plum-500 (primary brand)
        "accent-dark": "#4B2D42",     // → plum-600
        "gray-light": "#F6F2EC",      // → parchment (warm page bg)
        "gray-card": "#EFE9DF",       // → oat (soft raised surface)
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-instrument-serif)",
          "Iowan Old Style",
          "Georgia",
          "serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        12: ["12px", { lineHeight: "1.5" }],
        13: ["13px", { lineHeight: "1.5" }],
        14: ["14px", { lineHeight: "1.5" }],
        15: ["15px", { lineHeight: "1.5" }],
        16: ["16px", { lineHeight: "1.5" }],
        18: ["18px", { lineHeight: "1.3" }],
        20: ["20px", { lineHeight: "1.3" }],
        24: ["24px", { lineHeight: "1.3" }],
        30: ["30px", { lineHeight: "1.3" }],
        36: ["36px", { lineHeight: "1.3" }],
        48: ["48px", { lineHeight: "1.15" }],
        60: ["60px", { lineHeight: "1.15" }],
        72: ["72px", { lineHeight: "1.15" }],
      },
      letterSpacing: {
        display: "-0.02em",
        heading: "-0.015em",
        eyebrow: "0.08em",
      },
      spacing: {
        // 4px-based scale aliases — standard Tailwind numeric scale still works.
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
        "4xl": "64px",
        "5xl": "96px",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
        pill: "999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(40, 30, 20, 0.04), 0 2px 4px rgba(40, 30, 20, 0.03)",
        md: "0 4px 12px rgba(40, 30, 20, 0.06), 0 8px 24px rgba(40, 30, 20, 0.04)",
        lg: "0 12px 32px rgba(40, 30, 20, 0.10), 0 24px 64px rgba(40, 30, 20, 0.06)",
        focus: "0 0 0 2px #F6F2EC, 0 0 0 4px #5F3A53",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 0.61, 0.36, 1)",
        "in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "280ms",
      },
      maxWidth: {
        "content-narrow": "720px",
        "content-default": "1200px",
        "content-wide": "1360px",
      },
    },
  },
  plugins: [],
};
export default config;
