import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}
globalThis.localStorage ??= new MemoryStorage() as unknown as Storage;

const { mergeSerie, nextBadge, onSerieChange, readSerie, recordActivity, serieStats } = await import("./serie");

const data = (...days: string[]) => ({ jours: Object.fromEntries(days.map((d) => [d, { quiz: 1 }])) });

describe("série de révision", () => {
  beforeEach(() => localStorage.clear());

  it("compte les jours d'affilée et le record", () => {
    const s = serieStats(data("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-06", "2026-10-07"), "2026-10-07");
    expect(s).toMatchObject({ actuelle: 2, record: 3, aujourdhui: true, total: 5 });
    // Pas encore révisé aujourd'hui : la série d'hier tient toujours.
    expect(serieStats(data("2026-10-05", "2026-10-06"), "2026-10-07")).toMatchObject({ actuelle: 2, aujourdhui: false });
    // Un jour manqué : la série retombe à zéro.
    expect(serieStats(data("2026-10-04", "2026-10-05"), "2026-10-07").actuelle).toBe(0);
    // Passage d'un mois à l'autre.
    expect(serieStats(data("2026-09-30", "2026-10-01"), "2026-10-01").actuelle).toBe(2);
  });

  it("débloque les badges au premier geste du jour seulement", () => {
    const listener = vi.fn();
    const off = onSerieChange(listener);
    recordActivity("quiz", "2026-10-05");
    recordActivity("quiz", "2026-10-06");
    recordActivity("flashcards", "2026-10-07");
    recordActivity("flashcards", "2026-10-07");
    off();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls[0][1].map((b: { jours: number }) => b.jours)).toEqual([1]);
    expect(listener.mock.calls[2][1].map((b: { jours: number }) => b.jours)).toEqual([3]);
    expect(readSerie().jours["2026-10-07"]).toEqual({ flashcards: 2 });
    expect(nextBadge(3)?.jours).toBe(7);
  });

  it("réunit les jours de deux appareils", () => {
    const a = { jours: { "2026-10-01": { quiz: 2 }, "2026-10-02": { flashcards: 1 } } };
    const b = { jours: { "2026-10-01": { quiz: 1, edition: 4 }, "2026-10-03": { planning: 1 } } };
    expect(mergeSerie(a, b).jours).toEqual({
      "2026-10-01": { quiz: 2, edition: 4 },
      "2026-10-02": { flashcards: 1 },
      "2026-10-03": { planning: 1 },
    });
  });
});
