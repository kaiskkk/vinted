import { normalizeHex } from "../../shared/aiMap";

export const BG_PALETTE = [
  "#4f46e5",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#1e293b",
  "#ffffff",
  "#fde68a",
  "#fecaca",
  "#bbf7d0",
  "#bfdbfe",
  "#e9d5ff",
];

export const TEXT_PALETTE = ["#ffffff", "#0f172a", "#334155", "#94a3b8", "#fde047", "#f9a8d4", "#67e8f9", "#86efac"];

function channels(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? "#000000";
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Texte blanc ou sombre selon le fond. On favorise le blanc sur les couleurs vives
 * (rose, orange, turquoise…), plus lisible et plus esthétique en gras ; les fonds
 * clairs (jaune, pastels, blanc) gardent un texte sombre.
 */
export function contrastText(bg: string): string {
  const contrastWhite = 1.05 / (luminance(bg) + 0.05);
  return contrastWhite >= 2.4 ? "#ffffff" : "#0f172a";
}

/** Couleur trop claire ou trop sombre pour servir de trait sur le canevas. */
export function isNeutralColor(hex: string): boolean {
  const l = luminance(hex);
  return l > 0.75 || l < 0.03;
}
