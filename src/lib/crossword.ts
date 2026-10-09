// Mots croisés : place les mots du cours sur une grille compacte où ils se croisent.
import { crosswordWord } from "../../shared/study";

export type Dir = "across" | "down";

export interface PlacedWord {
  /** Mot en majuscules sans accents (lettres de la grille). */
  word: string;
  /** Mot tel qu'écrit dans le cours, pour la solution. */
  display: string;
  clue: string;
  row: number;
  col: number;
  dir: Dir;
  number: number;
}

export interface Crossword {
  rows: number;
  cols: number;
  words: PlacedWord[];
  /** Lettre attendue dans chaque case, ou null pour une case noire. */
  solution: (string | null)[][];
}

const key = (r: number, c: number) => `${r},${c}`;
const step = (dir: Dir) => (dir === "across" ? [0, 1] : [1, 0]);

interface Draft {
  word: string;
  display: string;
  clue: string;
  row: number;
  col: number;
  dir: Dir;
}

/** Une tentative de placement ; renvoie la grille obtenue. */
function attempt(entries: { word: string; display: string; clue: string }[], maxSize: number): Draft[] {
  const letters = new Map<string, string>();
  const used = new Map<string, Set<Dir>>();
  const placed: Draft[] = [];
  let minR = 0;
  let maxR = 0;
  let minC = 0;
  let maxC = 0;

  const place = (d: Draft) => {
    const [dr, dc] = step(d.dir);
    for (let k = 0; k < d.word.length; k++) {
      const id = key(d.row + dr * k, d.col + dc * k);
      letters.set(id, d.word[k]);
      used.set(id, new Set([...(used.get(id) ?? []), d.dir]));
    }
    minR = Math.min(minR, d.row);
    minC = Math.min(minC, d.col);
    maxR = Math.max(maxR, d.row + dr * (d.word.length - 1));
    maxC = Math.max(maxC, d.col + dc * (d.word.length - 1));
    placed.push(d);
  };

  /** Nombre de croisements si le mot peut être posé là, sinon -1. */
  const fits = (word: string, row: number, col: number, dir: Dir): number => {
    const [dr, dc] = step(dir);
    // Les cases juste avant et juste après le mot doivent rester vides.
    if (letters.has(key(row - dr, col - dc)) || letters.has(key(row + dr * word.length, col + dc * word.length))) return -1;
    let crossings = 0;
    for (let k = 0; k < word.length; k++) {
      const r = row + dr * k;
      const c = col + dc * k;
      const existing = letters.get(key(r, c));
      if (existing) {
        if (existing !== word[k] || used.get(key(r, c))?.has(dir)) return -1;
        crossings++;
      } else {
        // Pas de lettre collée sur les côtés (elle formerait un mot qui n'existe pas).
        const [sr, sc] = dir === "across" ? [1, 0] : [0, 1];
        if (letters.has(key(r + sr, c + sc)) || letters.has(key(r - sr, c - sc))) return -1;
      }
    }
    if (crossings === word.length) return -1;
    const top = Math.min(minR, row);
    const left = Math.min(minC, col);
    const bottom = Math.max(maxR, row + dr * (word.length - 1));
    const right = Math.max(maxC, col + dc * (word.length - 1));
    if (bottom - top + 1 > maxSize || right - left + 1 > maxSize) return -1;
    return crossings;
  };

  const [first, ...rest] = entries;
  if (!first) return [];
  place({ ...first, row: 0, col: 0, dir: "across" });
  let pending = rest;
  // Plusieurs passes : un mot qui ne croisait rien peut trouver sa place plus tard.
  for (let pass = 0; pass < 3 && pending.length; pass++) {
    const left: typeof pending = [];
    for (const e of pending) {
      let best: { d: Draft; score: number } | null = null;
      for (const p of placed) {
        const [pr, pc] = step(p.dir);
        for (let i = 0; i < p.word.length; i++) {
          for (let j = 0; j < e.word.length; j++) {
            if (p.word[i] !== e.word[j]) continue;
            const dir: Dir = p.dir === "across" ? "down" : "across";
            const [dr, dc] = step(dir);
            const row = p.row + pr * i - dr * j;
            const col = p.col + pc * i - dc * j;
            const crossings = fits(e.word, row, col, dir);
            if (crossings < 1) continue;
            const area =
              (Math.max(maxR, row + dr * (e.word.length - 1)) - Math.min(minR, row) + 1) *
              (Math.max(maxC, col + dc * (e.word.length - 1)) - Math.min(minC, col) + 1);
            // Beaucoup de croisements, grille compacte.
            const score = crossings * 100 - area;
            if (!best || score > best.score) best = { d: { ...e, row, col, dir }, score };
          }
        }
      }
      if (best) place(best.d);
      else left.push(e);
    }
    pending = left;
  }
  return placed.map((d) => ({ ...d, row: d.row - minR, col: d.col - minC }));
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Construit la meilleure grille parmi plusieurs essais (le plus de mots, puis la plus compacte). */
export function buildCrossword(entries: { mot: string; indice: string }[], random: () => number = Math.random, maxSize = 13): Crossword {
  const seen = new Set<string>();
  const words = entries
    .map((e) => ({ word: crosswordWord(e.mot), display: e.mot, clue: e.indice }))
    .filter((e) => e.word.length >= 3 && e.word.length <= maxSize && !seen.has(e.word) && (seen.add(e.word), true));

  let best: Draft[] = [];
  let bestArea = Infinity;
  for (let t = 0; t < 12; t++) {
    // Les longs mots d'abord, dans un ordre un peu différent à chaque essai.
    const order = shuffled(words, random).sort((a, b) => b.word.length - a.word.length + (random() - 0.5) * 3);
    const drafts = attempt(order, maxSize);
    const rows = Math.max(0, ...drafts.map((d) => d.row + (d.dir === "down" ? d.word.length : 1)));
    const cols = Math.max(0, ...drafts.map((d) => d.col + (d.dir === "across" ? d.word.length : 1)));
    const area = rows * cols;
    if (drafts.length > best.length || (drafts.length === best.length && area < bestArea)) {
      best = drafts;
      bestArea = area;
    }
  }

  const rows = Math.max(0, ...best.map((d) => d.row + (d.dir === "down" ? d.word.length : 1)));
  const cols = Math.max(0, ...best.map((d) => d.col + (d.dir === "across" ? d.word.length : 1)));
  const solution: (string | null)[][] = Array.from({ length: rows }, () => Array<string | null>(cols).fill(null));
  for (const d of best) {
    const [dr, dc] = step(d.dir);
    for (let k = 0; k < d.word.length; k++) solution[d.row + dr * k][d.col + dc * k] = d.word[k];
  }
  // Numéros dans l'ordre de lecture ; un même numéro pour l'horizontal et le vertical qui partent de la même case.
  const starts = [...new Set(best.map((d) => key(d.row, d.col)))].sort((a, b) => {
    const [ar, ac] = a.split(",").map(Number);
    const [br, bc] = b.split(",").map(Number);
    return ar - br || ac - bc;
  });
  const numberOf = new Map(starts.map((s, i) => [s, i + 1]));
  const placed = best
    .map((d) => ({ ...d, number: numberOf.get(key(d.row, d.col))! }))
    .sort((a, b) => a.number - b.number || (a.dir === "across" ? -1 : 1));
  return { rows, cols, words: placed, solution };
}

/** Cases d'un mot placé. */
export const cellsOf = (w: PlacedWord): [number, number][] =>
  Array.from({ length: w.word.length }, (_, k) => (w.dir === "across" ? [w.row, w.col + k] : [w.row + k, w.col]));
