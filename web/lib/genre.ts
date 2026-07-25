// Per-genre visual identity for series covers — keeps cards varied + eye-catching
// while staying within the warm editorial palette.
export type GenreStyle = {
  from: string;
  to: string;
  accent: string;
  glyph: string; // decorative motif label
};

const MAP: Record<string, GenreStyle> = {
  Fantasy: { from: "#f3b03a", to: "#c23616", accent: "#c23616", glyph: "✦" },
  "Sci-Fi": { from: "#6366f1", to: "#0ea5e9", accent: "#4f46e5", glyph: "◈" },
  Drama: { from: "#15803d", to: "#0d9488", accent: "#15803d", glyph: "❦" },
  Mystery: { from: "#7c3aed", to: "#c23616", accent: "#7c3aed", glyph: "◑" },
  Horror: { from: "#7f1d1d", to: "#1a1a1a", accent: "#7f1d1d", glyph: "✧" },
  Romance: { from: "#ec4899", to: "#f59e0b", accent: "#db2777", glyph: "❧" },
};

const DEFAULT: GenreStyle = { from: "#c23616", to: "#f3b03a", accent: "#c23616", glyph: "✦" };

export function genreStyle(genre?: string | null): GenreStyle {
  return (genre && MAP[genre]) || DEFAULT;
}
