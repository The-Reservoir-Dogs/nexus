import type { Config } from "tailwindcss";

// Warm-paper editorial theme (kodwai-inspired). Light background, terracotta accent,
// serif headlines, mono labels.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // surfaces (warm paper)
        ink: "#faf8f4", // page background
        panel: "#fffdf9", // cards
        "panel-2": "#f3efe8", // raised / hover
        line: "#e4e0d8", // hairline borders
        "line-2": "#d6cfc1",
        // text
        text: "#1a1a1a", // headlines / primary
        body: "#3a3733", // body copy
        muted: "#736d63", // secondary / mono labels
        // accents
        canon: "#c23616", // terracotta = canonical / verified / brand
        fork: "#15803d", // green = alternate timeline
        accent: "#ff6a45", // bright orange
        amber: "#f3b03a",
        success: "#15803d",
        danger: "#c23616",
        cream: "#fbf7f0",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-rise": "fade-rise 0.4s cubic-bezier(0.16,1,0.3,1) both",
      },
      boxShadow: {
        cta: "0 4px 16px -8px rgba(194,54,22,0.4)",
        card: "0 1px 2px rgba(40,24,12,0.04), 0 12px 30px -20px rgba(40,24,12,0.18)",
        lift: "0 10px 30px -14px rgba(40,24,12,0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
