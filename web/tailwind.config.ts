import type { Config } from "tailwindcss";

// NEXUS professional theme — GitHub-tool aesthetic. Neutral dark surfaces, functional
// accents (gold=canonical/stars, blue=branches/links, violet=AI), sans everywhere, dense.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // surfaces (GitHub dark)
        ink: "#0d1117", // page background
        panel: "#161b22", // cards / panels
        "panel-2": "#21262d", // raised / hover
        line: "#30363d", // hairline borders
        "line-2": "#3d444d",
        // text
        text: "#e6edf3", // primary
        body: "#c9d1d9", // body copy
        muted: "#8b949e", // secondary / labels
        // accents (functional)
        canon: "#d29922", // gold = canonical / stars
        fork: "#2f81f7", // blue = branches / links
        accent: "#238636", // green = primary action (Git "create/commit")
        "accent-hover": "#2ea043",
        amber: "#d29922",
        ai: "#a371f7", // violet = agent / AI
        success: "#238636",
        danger: "#f85149",
        cream: "#161b22",
      },
      fontFamily: {
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
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
      borderRadius: {
        DEFAULT: "6px",
      },
      boxShadow: {
        cta: "0 1px 0 rgba(0,0,0,0.3)",
        card: "0 1px 0 rgba(0,0,0,0.2)",
        lift: "0 8px 24px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(47,129,247,0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
