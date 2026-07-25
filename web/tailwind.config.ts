import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0F",
        panel: "#14141F",
        "panel-2": "#1C1C2A",
        line: "#2A2A3C",
        canon: "#F5C518",
        fork: "#8B5CF6",
        text: "#ECECF5",
        muted: "#9A9AB0",
        success: "#34D399",
        danger: "#F87171",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.25s ease-out both",
      },
      boxShadow: {
        "glow-canon": "0 0 0 1px rgba(245,197,24,0.5), 0 8px 30px -8px rgba(245,197,24,0.35)",
        "glow-fork": "0 0 0 1px rgba(139,92,246,0.5), 0 8px 30px -8px rgba(139,92,246,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
