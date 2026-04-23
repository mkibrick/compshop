import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1A2332",
        accent: "#2E86AB",
        "accent-dark": "#246d8e",
        "gray-light": "#F5F7FA",
        "gray-card": "#EBEEF2",
      },
    },
  },
  plugins: [],
};
export default config;
