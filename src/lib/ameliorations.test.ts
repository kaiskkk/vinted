import { beforeEach, describe, expect, it } from "vitest";

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

const nouveautes = await import("./nouveautes");
const minuteur = await import("./minuteur");
const recherche = await import("./recherche");
const docs = await import("./docs");
const dernier = await import("./dernier");

describe("nouveautés", () => {
  beforeEach(() => localStorage.clear());

  it("versions uniques, de la plus récente à la plus ancienne", () => {
    const versions = nouveautes.NOUVEAUTES.map((n) => n.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort().reverse()).toEqual(versions);
    expect(nouveautes.DERNIERE_VERSION).toBe(versions[0]);
  });

  it("message d'arrivée : bienvenue, mise à jour ou rien", () => {
    const jamais = () => false;
    const deja = () => true;
    expect(nouveautes.messageArrivee(null, jamais)).toEqual({ kind: "bienvenue" });
    // Élève venu avant l'existence du message : il voit la dernière mise à jour.
    expect(nouveautes.messageArrivee(null, deja)).toEqual({ kind: "maj", maj: [nouveautes.NOUVEAUTES[0]] });
    const avant = nouveautes.NOUVEAUTES[2].version;
    const r = nouveautes.messageArrivee(avant, deja);
    expect(r?.kind === "maj" && r.maj.map((m) => m.version)).toEqual([nouveautes.NOUVEAUTES[0].version, nouveautes.NOUVEAUTES[1].version]);
    expect(nouveautes.messageArrivee(nouveautes.DERNIERE_VERSION, deja)).toBeNull();
    nouveautes.marquerVu();
    expect(nouveautes.versionVue()).toBe(nouveautes.DERNIERE_VERSION);
  });
});

describe("minuteur de révision", () => {
  const T0 = 1_000_000;
  it("travail, pause, reprise, fin", () => {
    let s = minuteur.initialState(T0);
    expect(minuteur.remaining(s, T0)).toBe(25 * 60_000);
    s = minuteur.start(s, T0);
    expect(minuteur.isRunning(s)).toBe(true);
    expect(minuteur.formatTemps(minuteur.remaining(s, T0 + 1000))).toBe("24:59");
    s = minuteur.pauseTimer(s, T0 + 60_000);
    expect(minuteur.isRunning(s)).toBe(false);
    expect(minuteur.remaining(s, T0 + 10 * 60_000)).toBe(24 * 60_000);
    s = minuteur.resume(s, T0 + 10 * 60_000);
    expect(s.fin).toBe(T0 + 34 * 60_000);
    s = minuteur.nextPhase(s, s.fin as number);
    expect(s.phase).toBe("pause");
    expect(s.seances).toBe(1);
    expect(minuteur.remaining(s, T0 + 34 * 60_000)).toBe(5 * 60_000);
    s = minuteur.nextPhase(s);
    expect(s.phase).toBeNull();
    expect(s.seances).toBe(1);
  });

  it("relit l'état gardé, et remet les séances à zéro le lendemain", () => {
    const hier = Date.UTC(2026, 9, 9, 10);
    const raw = JSON.stringify({ ...minuteur.start(minuteur.initialState(hier), hier), seances: 3, travail: 45, pause: 99 });
    const meme = minuteur.parseMinuteur(raw, hier + 60_000);
    expect(meme).toMatchObject({ phase: "travail", seances: 3, travail: 45, pause: 5 });
    expect(minuteur.parseMinuteur(raw, hier + 2 * 86_400_000).seances).toBe(0);
    expect(minuteur.parseMinuteur("n'importe quoi").phase).toBeNull();
  });
});

describe("recherche dans le contenu", () => {
  beforeEach(() => localStorage.clear());

  it("trouve un mot dans les blocs d'une fiche, sans tenir compte des accents", () => {
    const fiche = docs.blankFiche("Les plantes");
    fiche.blocs[0].contenu = "La **photosynthèse** a lieu dans les chloroplastes, grâce à la lumière du soleil.";
    docs.saveDoc(fiche);
    const index = recherche.buildIndex([{ kind: "fiche", id: fiche.id }]);
    const entry = index.get(recherche.itemKey({ kind: "fiche", id: fiche.id }));
    expect(recherche.findSnippet(entry, "PHOTOSYNTHESE")).toContain("photosynthèse a lieu");
    expect(recherche.findSnippet(entry, "lumiere")).toContain("lumière du soleil");
    expect(recherche.findSnippet(entry, "volcan")).toBeNull();
  });

  it("garde le dernier élément ouvert", () => {
    dernier.rememberOpened("quiz", "q1", 123);
    expect(dernier.lastOpened()).toEqual({ kind: "quiz", id: "q1", at: 123 });
  });
});
