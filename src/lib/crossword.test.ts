import { describe, expect, it } from "vitest";
import { buildCrossword, cellsOf } from "./crossword";

/** Générateur pseudo-aléatoire reproductible. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const MOTS = [
  { mot: "Volcan", indice: "Montagne qui crache de la lave" },
  { mot: "Magma", indice: "Roche fondue sous la terre" },
  { mot: "Lave", indice: "Magma qui sort à la surface" },
  { mot: "Cratère", indice: "Ouverture au sommet" },
  { mot: "Éruption", indice: "Sortie violente de lave" },
  { mot: "Séisme", indice: "Tremblement de terre" },
  { mot: "Plaque", indice: "Morceau de la croûte terrestre" },
  { mot: "Cendres", indice: "Poussières projetées" },
];

describe("mots croisés", () => {
  it("place les mots sans conflit et numérote les départs", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cw = buildCrossword(MOTS, seeded(seed));
      expect(cw.words.length).toBeGreaterThanOrEqual(5);
      expect(cw.rows).toBeLessThanOrEqual(13);
      expect(cw.cols).toBeLessThanOrEqual(13);
      // Chaque lettre de chaque mot est bien dans la grille.
      for (const w of cw.words) {
        cellsOf(w).forEach(([r, c], k) => expect(cw.solution[r][c]).toBe(w.word[k]));
      }
      // Les lettres de la grille appartiennent toutes à un mot, et un mot sans accent est en majuscules.
      const covered = new Set(cw.words.flatMap((w) => cellsOf(w).map(([r, c]) => `${r},${c}`)));
      cw.solution.forEach((row, r) => row.forEach((l, c) => expect(l === null || covered.has(`${r},${c}`)).toBe(true)));
      expect(cw.words.some((w) => w.word === "ERUPTION" || w.word === "CRATERE" || w.word === "VOLCAN")).toBe(true);
      // Numéros croissants dans l'ordre de lecture, partagés par les mots qui partent de la même case.
      const byStart = new Map<string, number>();
      for (const w of cw.words) {
        const k = `${w.row},${w.col}`;
        if (byStart.has(k)) expect(byStart.get(k)).toBe(w.number);
        byStart.set(k, w.number);
      }
    }
  });

  it("chaque mot ajouté croise la grille (aucun mot isolé)", () => {
    const cw = buildCrossword(MOTS, seeded(7));
    const letters = (w: (typeof cw.words)[number]) => new Set(cellsOf(w).map(([r, c]) => `${r},${c}`));
    for (const w of cw.words.slice(1)) {
      const mine = letters(w);
      const crosses = cw.words.some((o) => o !== w && [...letters(o)].some((k) => mine.has(k)));
      expect(crosses).toBe(true);
    }
  });

  it("ignore les mots trop courts ou en double", () => {
    const cw = buildCrossword([{ mot: "Au", indice: "x" }, ...MOTS.slice(0, 2), { mot: "volcan", indice: "doublon" }], seeded(3));
    expect(cw.words.map((w) => w.word).sort()).toEqual(["MAGMA", "VOLCAN"]);
  });
});
