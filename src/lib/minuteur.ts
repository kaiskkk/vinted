// Minuteur de révision (méthode Pomodoro) : un temps de travail, puis une pause.
// L'état est gardé dans l'appareil : il continue si l'élève change de page ou recharge le site.

export type Phase = "travail" | "pause";

export interface MinuteurState {
  /** null : arrêté. */
  phase: Phase | null;
  /** Fin prévue (ms) pendant qu'il tourne ; null quand il est mis en pause. */
  fin: number | null;
  /** Temps restant (ms) quand il est mis en pause. */
  reste: number;
  /** Durées choisies, en minutes. */
  travail: number;
  pause: number;
  /** Séances de travail terminées aujourd'hui. */
  seances: number;
  jour: string;
}

export const DUREES_TRAVAIL = [15, 25, 45];
export const DUREES_PAUSE = [5, 10];

const KEY = "ed-minuteur";
const MIN = 60_000;
const jourDe = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const initialState = (now = Date.now()): MinuteurState => ({
  phase: null,
  fin: null,
  reste: 0,
  travail: 25,
  pause: 5,
  seances: 0,
  jour: jourDe(now),
});

export function parseMinuteur(raw: string | null, now = Date.now()): MinuteurState {
  const base = initialState(now);
  try {
    const o = JSON.parse(raw ?? "null") as Partial<MinuteurState> | null;
    if (!o || typeof o !== "object") return base;
    const s: MinuteurState = {
      phase: o.phase === "travail" || o.phase === "pause" ? o.phase : null,
      fin: typeof o.fin === "number" ? o.fin : null,
      reste: typeof o.reste === "number" && o.reste > 0 ? o.reste : 0,
      travail: DUREES_TRAVAIL.includes(o.travail as number) ? (o.travail as number) : 25,
      pause: DUREES_PAUSE.includes(o.pause as number) ? (o.pause as number) : 5,
      seances: typeof o.seances === "number" && o.seances > 0 ? Math.floor(o.seances) : 0,
      jour: typeof o.jour === "string" ? o.jour : base.jour,
    };
    if (!s.phase) s.fin = null;
    // Nouveau jour : le compteur de séances repart à zéro.
    if (s.jour !== base.jour) s.seances = 0;
    s.jour = base.jour;
    return s;
  } catch {
    return base;
  }
}

/** Temps restant (ms), arrondi à zéro. */
export const remaining = (s: MinuteurState, now = Date.now()) => (s.phase ? (s.fin !== null ? Math.max(0, s.fin - now) : s.reste) : s.travail * MIN);

export const isRunning = (s: MinuteurState) => s.phase !== null && s.fin !== null;

/** « 24:59 » */
export function formatTemps(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ---------- Transitions (pures, testées) ----------

export const start = (s: MinuteurState, now = Date.now()): MinuteurState => ({ ...s, phase: "travail", fin: now + s.travail * MIN, reste: 0 });

export const pauseTimer = (s: MinuteurState, now = Date.now()): MinuteurState =>
  isRunning(s) ? { ...s, fin: null, reste: Math.max(0, (s.fin as number) - now) } : s;

export const resume = (s: MinuteurState, now = Date.now()): MinuteurState => (s.phase && s.fin === null ? { ...s, fin: now + s.reste, reste: 0 } : s);

export const stop = (s: MinuteurState): MinuteurState => ({ ...s, phase: null, fin: null, reste: 0 });

/** Fin d'une phase : travail → pause (une séance de plus) ; pause → arrêt. */
export function nextPhase(s: MinuteurState, now = Date.now()): MinuteurState {
  if (s.phase === "travail") return { ...s, phase: "pause", fin: now + s.pause * MIN, reste: 0, seances: s.seances + 1 };
  return stop(s);
}

// ---------- Magasin partagé par tout le site ----------

let state: MinuteurState = typeof window === "undefined" ? initialState() : read();
const listeners = new Set<(s: MinuteurState) => void>();

function read(): MinuteurState {
  try {
    return parseMinuteur(localStorage.getItem(KEY));
  } catch {
    return initialState();
  }
}

export const getMinuteur = () => state;

export function setMinuteur(next: MinuteurState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Non mémorisé : le minuteur continue tant que la page reste ouverte.
  }
  listeners.forEach((l) => l(state));
}

export function subscribeMinuteur(fn: (s: MinuteurState) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
