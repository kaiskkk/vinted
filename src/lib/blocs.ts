import type { BlocType } from "../../shared/study";
import type { FicheStyle } from "./docs";

/** Code couleur des fiches : chaque type d'information a sa couleur et son pictogramme. */
export const BLOC_META: Record<BlocType, { label: string; color: string; emoji: string }> = {
  notion: { label: "Notion clé", color: "#6366f1", emoji: "💡" },
  definition: { label: "Définition", color: "#2563eb", emoji: "📖" },
  date: { label: "Date", color: "#d97706", emoji: "📅" },
  formule: { label: "Formule", color: "#7c3aed", emoji: "🧮" },
  exemple: { label: "Exemple", color: "#059669", emoji: "✏️" },
  piege: { label: "Piège", color: "#dc2626", emoji: "⚠️" },
  retenir: { label: "À retenir", color: "#db2777", emoji: "⭐" },
  texte: { label: "Texte libre", color: "#475569", emoji: "📝" },
};

/** Couleurs proposées pour personnaliser un bloc. */
export const BLOC_COLORS = ["#6366f1", "#2563eb", "#0891b2", "#059669", "#65a30d", "#d97706", "#ea580c", "#dc2626", "#db2777", "#7c3aed", "#475569"];

export const STYLE_LABELS: Record<FicheStyle, string> = {
  classique: "Classique",
  coloree: "Colorée",
  minimaliste: "Minimaliste",
  cahier: "Cahier",
};
