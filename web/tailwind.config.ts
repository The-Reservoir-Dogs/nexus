import type { Config } from "tailwindcss";

// NEXUS dark cinematic theme ("The Hollow Crown"). Ink background, antique-gold accent,
// arcane-violet for AI, serif story body. Token names kept stable across the redesign.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // surfaces (ink)
        ink: "#0B0B0F", // page background
        panel: "#15151C", // cards / panels
        "panel-2": "#1E1E28", // raised / hover
        line: "#2A2A36", // hairline borders
        "line-2": "#343442",
        // text
        text: "#ECEAE4", // headlines / primary (warm off-white)
        body: "#C9C5BC", // body copy
        muted: "#9A968C", // secondary / mono labels
        // accents
        canon: "#D9A441", // antique gold = canonical / verified / brand
        fork: "#5B8DEF", // blue = alternate timeline
        accent: "#D9A441", // primary action = gold
        amber: "#E4B84E",
        ai: "#7C5CFF", // arcane violet = agent / AI surfaces
        success: "#3FB950",
        danger: "#E5484D",
        cream: "#1E1E28",
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
        cta: "0 6px 24px -10px rgba(217,164,65,0.45)",
        card: "0 1px 2px rgba(0,0,0,0.5), 0 18px 40px -24px rgba(0,0,0,0.7)",
        lift: "0 16px 44px -18px rgba(0,0,0,0.75)",
        glow: "0 0 0 1px rgba(217,164,65,0.25), 0 0 28px -6px rgba(217,164,65,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
