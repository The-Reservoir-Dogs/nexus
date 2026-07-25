import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // warm literary ink base
        ink: "#0B0910",
        panel: "#151020",
        "panel-2": "#1E1730",
        line: "#2C2340",
        text: "#F4EFE6", // warm parchment
        muted: "#A89FB8",
        // semantic
        canon: "#F5B642", // amber-gold = canonical / verified
        fork: "#9A6BFF", // electric violet = alternate timeline
        // aurora signature accents
        aurora1: "#7C5CFF",
        aurora2: "#FF4D8D",
        aurora3: "#FFB347",
        accent: "#FF4D8D", // hot magenta highlight
        success: "#3FD68B",
        danger: "#FF6B6B",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        aurora: "linear-gradient(120deg, #7C5CFF 0%, #FF4D8D 55%, #FFB347 100%)",
        "aurora-soft":
          "linear-gradient(120deg, rgba(124,92,255,0.18), rgba(255,77,141,0.14), rgba(255,179,71,0.12))",
      },
      keyframes: {
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "aurora-pan": {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "aurora-pan": "aurora-pan 8s ease infinite",
      },
      boxShadow: {
        "glow-canon": "0 0 0 1px rgba(245,182,66,0.4), 0 12px 40px -12px rgba(245,182,66,0.45)",
        "glow-fork": "0 0 0 1px rgba(154,107,255,0.4), 0 12px 40px -12px rgba(154,107,255,0.5)",
        "glow-accent": "0 10px 40px -10px rgba(255,77,141,0.5)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -30px rgba(0,0,0,0.9)",
      },
    },
  },
  plugins: [],
};

export default config;
