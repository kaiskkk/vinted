// Série de jours de révision 🔥 : chaque jour où l'élève révise (quiz, flashcards, planning,
// génération, question, rédaction, modification d'un document) compte. Record et badges.
import { addDays, daysBetween, today } from "./planning";

const KEY = "ed-serie";

export type Activite =
  | "quiz"
  | "flashcards"
  | "planning"
  | "generation"
  | "question"
  | "redaction"
  | "edition"
  | "exercice"
  | "jeu"
  | "copie"
  | "devoir"
  | "oral"
  | "minuteur";

export interface SerieData {
  /** Jour local AAAA-MM-JJ → nombre d'activités de chaque type. */
  jours: Record<string, Partial<Record<Activite, number>>>;
}

export interface Badge {
  jours: number;
  nom: string;
  emoji: string;
}

export const BADGES: Badge[] = [
  { jours: 1, nom: "Premier pas", emoji: "🌱" },
  { jours: 3, nom: "Bien parti", emoji: "🔥" },
  { jours: 7, nom: "Une semaine", emoji: "⭐" },
  { jours: 14, nom: "Deux semaines", emoji: "💪" },
  { jours: 30, nom: "Un mois", emoji: "🏆" },
  { jours: 60, nom: "Deux mois", emoji: "🚀" },
  { jours: 100, nom: "100 jours", emoji: "💯" },
  { jours: 365, nom: "Un an", emoji: "👑" },
];

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function parseSerie(text: string | null): SerieData {
  try {
    const raw = JSON.parse(text ?? "null");
    const jours = raw && typeof raw === "object" && raw.jours && typeof raw.jours === "object" ? raw.jours : {};
    return { jours: Object.fromEntries(Object.entries(jours).filter(([d, v]) => isDay(d) && v && typeof v === "object")) as SerieData["jours"] };
  } catch {
    return { jours: {} };
  }
}

export function readSerie(): SerieData {
  try {
    return parseSerie(localStorage.getItem(KEY));
  } catch {
    return { jours: {} };
  }
}

/** Réunit les jours de révision de deux appareils (pour chaque activité, le plus grand nombre). */
export function mergeSerie(a: SerieData, b: SerieData): SerieData {
  const jours: SerieData["jours"] = { ...a.jours };
  for (const [d, acts] of Object.entries(b.jours)) {
    const day = { ...(jours[d] ?? {}) };
    for (const [k, n] of Object.entries(acts) as [Activite, number][]) if (typeof n === "number") day[k] = Math.max(day[k] ?? 0, n);
    jours[d] = day;
  }
  return { jours };
}

export interface SerieStats {
  /** Jours consécutifs jusqu'à aujourd'hui (ou hier si l'élève n'a pas encore révisé aujourd'hui). */
  actuelle: number;
  record: number;
  aujourdhui: boolean;
  total: number;
  jours: Set<string>;
}

export function serieStats(data: SerieData = readSerie(), now = today()): SerieStats {
  const jours = new Set(Object.keys(data.jours).filter((d) => d <= now));
  const sorted = [...jours].sort();
  let record = 0;
  let run = 0;
  let prev = "";
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    record = Math.max(record, run);
    prev = d;
  }
  const aujourdhui = jours.has(now);
  let actuelle = 0;
  let cursor = aujourdhui ? now : addDays(now, -1);
  while (jours.has(cursor)) {
    actuelle++;
    cursor = addDays(cursor, -1);
  }
  return { actuelle, record, aujourdhui, total: jours.size, jours };
}

export const unlockedBadges = (record: number) => BADGES.filter((b) => record >= b.jours);
export const nextBadge = (record: number) => BADGES.find((b) => record < b.jours);

type Listener = (stats: SerieStats, nouveaux: Badge[]) => void;
const listeners = new Set<Listener>();
export function onSerieChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Note une activité de révision aujourd'hui ; prévient l'interface si un badge est débloqué. */
export function recordActivity(kind: Activite, now = today()) {
  const data = readSerie();
  const before = serieStats(data, now);
  const day = data.jours[now] ?? {};
  day[kind] = (day[kind] ?? 0) + 1;
  data.jours[now] = day;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    return;
  }
  // Seul le premier geste du jour change la série : inutile de prévenir à chaque carte retournée.
  if (before.aujourdhui) return;
  const after = serieStats(data, now);
  const nouveaux = BADGES.filter((b) => before.record < b.jours && after.record >= b.jours);
  listeners.forEach((l) => l(after, nouveaux));
}

/** Petite phrase d'encouragement selon l'état de la série. */
export function serieMessage(s: SerieStats): string {
  if (s.aujourdhui)
    return s.actuelle >= s.record && s.actuelle > 1 ? "Record battu, continue comme ça\u00a0!" : "Bravo, tu as révisé aujourd'hui\u00a0!";
  if (s.actuelle > 0) return "Révise aujourd'hui pour garder ta série.";
  return "Révise aujourd'hui pour lancer une série.";
}
