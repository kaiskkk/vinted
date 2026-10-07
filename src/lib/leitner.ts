// Répétition espacée simple (boîtes de Leitner) pour les flashcards.
import type { Flashcard } from "./docs";

const DAY = 86_400_000;
/** Délai avant de revoir une carte selon sa boîte (en jours). */
export const INTERVALLES = [0, 1, 3, 7, 14, 30];

const startOfDay = (now: number) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const isDue = (c: Flashcard, now = Date.now()) => c.prochaine <= now;

/** « Je sais » : la carte monte d'une boîte et revient plus tard. « À revoir » : retour à la première boîte. */
export function answer(c: Flashcard, knew: boolean, now = Date.now()): Flashcard {
  const boite = knew ? Math.min(5, c.boite + 1) : 0;
  return {
    ...c,
    boite,
    prochaine: knew ? startOfDay(now) + INTERVALLES[boite] * DAY : now,
    revues: c.revues + 1,
    reussites: c.reussites + (knew ? 1 : 0),
  };
}

export interface DeckStats {
  total: number;
  nouvelles: number;
  aRevoir: number;
  enCours: number;
  maitrisees: number;
  /** Cartes à travailler maintenant (nouvelles comprises). */
  dues: number;
  /** Part des cartes maîtrisées, de 0 à 100. */
  progression: number;
}

export function deckStats(cartes: Flashcard[], now = Date.now()): DeckStats {
  const nouvelles = cartes.filter((c) => c.revues === 0).length;
  const maitrisees = cartes.filter((c) => c.boite >= 4).length;
  const aRevoir = cartes.filter((c) => c.revues > 0 && isDue(c, now)).length;
  return {
    total: cartes.length,
    nouvelles,
    aRevoir,
    enCours: cartes.length - nouvelles - maitrisees,
    maitrisees,
    dues: cartes.filter((c) => isDue(c, now)).length,
    progression: cartes.length ? Math.round((maitrisees / cartes.length) * 100) : 0,
  };
}

/** Ordre de passage : d'abord les cartes ratées ou en retard, puis les nouvelles. */
export function sessionQueue(cartes: Flashcard[], now = Date.now(), toutes = false): string[] {
  const pool = toutes ? cartes : cartes.filter((c) => isDue(c, now));
  return [...pool].sort((a, b) => Number(a.revues === 0) - Number(b.revues === 0) || a.boite - b.boite || a.prochaine - b.prochaine).map((c) => c.id);
}
