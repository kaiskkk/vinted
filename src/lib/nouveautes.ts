// Journal des mises à jour du site, affiché dans « Nouveautés ».
// Le message d'arrivée apparaît quand une version plus récente que la dernière vue est en ligne.

export interface MiseAJour {
  /** Identifiant croissant : date, et une lettre s'il y en a plusieurs le même jour. */
  version: string;
  date: string;
  titre: string;
  points: string[];
}

/** Du plus récent au plus ancien. Ajouter une entrée en haut à chaque mise à jour. */
export const NOUVEAUTES: MiseAJour[] = [
  {
    version: "2026-10-10b",
    date: "10 octobre 2026",
    titre: "Minuteur, recherche et « ecoleduc, c'est quoi ? »",
    points: [
      "⏱️ Minuteur de révision : 25 minutes de travail, puis une pause ; chaque séance compte dans ta série.",
      "🔎 La recherche de l'accueil fouille aussi le contenu de tes documents, pas seulement leurs titres.",
      "↩️ « Reprendre » : l'accueil te ramène au dernier document que tu as ouvert.",
      "ℹ️ Le bouton « ? » en haut à droite explique tout ecoleduc, avec ces nouveautés.",
    ],
  },
  {
    version: "2026-10-10",
    date: "10 octobre 2026",
    titre: "L'oral et Ma classe",
    points: [
      "🎤 Oral : le site te pose des questions à voix haute, tu réponds au micro, l'IA te corrige et te donne une note.",
      "👥 Ma classe : crée une classe avec un code, et partage tes fiches, quiz et cartes avec tous ses membres.",
    ],
  },
  {
    version: "2026-10-09",
    date: "9 octobre 2026",
    titre: "Exercices, jeux, copie, agenda et partage",
    points: [
      "🧮 Exercices avec indices et correction étape par étape.",
      "🧩 Jeux de révision : paires, textes à trous et mots croisés.",
      "📝 Ma copie : photographie une copie corrigée, l'IA t'explique tes erreurs.",
      "📅 Agenda des devoirs avec rappels.",
      "🔊 Lecture à voix haute de tous les documents.",
      "🔗 Partage par lien de tes documents, cartes et classeurs.",
    ],
  },
  {
    version: "2026-10-08",
    date: "8 octobre 2026",
    titre: "Comptes, dictée, frise et rédaction",
    points: [
      "👤 Comptes : tes données sont sauvegardées et retrouvées sur tous tes appareils.",
      "🎙️ Saisie vocale : dicte ton cours ou tes questions au micro.",
      "🕰️ Frise chronologique et ✍️ aide à la rédaction (problématique, plan, relecture).",
      "🔥 Série de révision, avec record et badges.",
    ],
  },
  {
    version: "2026-10-07",
    date: "7 octobre 2026",
    titre: "Tout pour réviser, avec une IA gratuite",
    points: [
      "📂 Classeurs : ajoute ton cours une fois (texte, PDF ou photo), l'IA prépare le reste.",
      "📄 Fiches, 🎯 fiches de révision et planning, ✅ quiz, 🃏 flashcards et résumés.",
      "✨ IA gratuite avec Google Gemini.",
    ],
  },
  {
    version: "2026-10-06",
    date: "6 octobre 2026",
    titre: "Naissance d'ecoleduc",
    points: ["🧠 Cartes mentales générées par l'IA et modifiables.", "📱 Version téléphone et appli installable, même sans connexion."],
  },
];

export const DERNIERE_VERSION = NOUVEAUTES[0].version;

const KEY = "ed-nouveautes-vues";

/** Dernière version vue sur cet appareil (null : première visite). */
export function versionVue(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Version vue au moment où le site s'est ouvert (avant que le message ne la marque comme vue). */
export const VUE_AU_DEMARRAGE = typeof window !== "undefined" ? versionVue() : null;

export function marquerVu() {
  try {
    localStorage.setItem(KEY, DERNIERE_VERSION);
  } catch {
    // Non mémorisé : le message reviendra à la prochaine visite.
  }
}

/** Mises à jour arrivées depuis la dernière visite. */
export function nonVues(vue: string | null = versionVue()): MiseAJour[] {
  if (!vue) return [];
  return NOUVEAUTES.filter((n) => n.version > vue);
}

/** L'appareil a-t-il déjà servi (documents, cartes, compte) ? */
function dejaVenu(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (/^(mm-map|ed-doc|ed-classeur):|^(sync-proprietaire|ed-serie|mm-theme-choice)$/.test(localStorage.key(i) ?? "")) return true;
    }
  } catch {
    // Stockage indisponible : on considère que c'est une première visite.
  }
  return false;
}

/** Ce que le message d'arrivée doit dire : bienvenue (première visite), mise à jour, ou rien. */
export function messageArrivee(
  vue: string | null = versionVue(),
  ancien = dejaVenu,
): { kind: "bienvenue" } | { kind: "maj"; maj: MiseAJour[] } | null {
  // Élève venu avant l'arrivée de ce message : on lui montre la dernière mise à jour.
  if (!vue) return ancien() ? { kind: "maj", maj: [NOUVEAUTES[0]] } : { kind: "bienvenue" };
  const maj = nonVues(vue);
  return maj.length ? { kind: "maj", maj } : null;
}
