import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d10",
          elevated: "#14181d",
          border: "#232a33",
        },
        accent: {
          DEFAULT: "#f59e0b",
          strong: "#fbbf24",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "huge": ["9rem", { lineHeight: "1" }],
        "mega": ["6rem", { lineHeight: "1" }],
      },
    },
  },
  plugins: [],
};

export default config;
