import { beforeEach, describe, expect, it } from "vitest";
import { answer, deckStats, sessionQueue } from "./leitner";
import { addDays, buildPlanning, daysBetween, parseChapitres } from "./planning";
import { newCard, quizFromIA, shuffleChoices, saveDoc, loadDoc, listDocs, createClasseur, linkMap, normalizeDoc, ficheFromIA } from "./docs";
import { deleteClasseurDeep, exportAll, importAll, listLibrary, restore } from "./library";
import { createMap, listMaps } from "./storage";

describe("planning de révision", () => {
  it("répartit apprentissage, révisions espacées, bilan et jour J", () => {
    const jours = buildPlanning(["Chap 1", "Chap 2", "Chap 3"], "2026-10-01", "2026-10-11");
    expect(jours).toHaveLength(11);
    expect(jours.at(-1)).toMatchObject({ date: "2026-10-11", taches: [{ genre: "examen" }] });
    expect(jours.at(-2)!.taches.every((t) => t.genre === "bilan")).toBe(true);
    const all = jours.flatMap((j) => j.taches);
    for (const c of ["Chap 1", "Chap 2", "Chap 3"]) {
      expect(all.filter((t) => t.chapitre === c && t.genre === "apprendre")).toHaveLength(1);
      expect(all.filter((t) => t.chapitre === c && t.genre === "reviser").length).toBeGreaterThanOrEqual(1);
    }
    // Chaque révision vient après l'apprentissage du chapitre.
    const dayOf = (pred: (t: (typeof all)[number]) => boolean) => jours.findIndex((j) => j.taches.some(pred));
    expect(dayOf((t) => t.chapitre === "Chap 3" && t.genre === "reviser")).toBeGreaterThan(
      dayOf((t) => t.chapitre === "Chap 3" && t.genre === "apprendre"),
    );
  });

  it("gère beaucoup de chapitres en peu de jours, et refuse une date passée", () => {
    const chapitres = Array.from({ length: 12 }, (_, i) => `C${i + 1}`);
    const jours = buildPlanning(chapitres, "2026-10-01", "2026-10-04");
    expect(jours.flatMap((j) => j.taches).filter((t) => t.genre === "apprendre")).toHaveLength(12);
    expect(() => buildPlanning(["A"], "2026-10-05", "2026-10-05")).toThrow(/demain/);
    expect(buildPlanning(["A"], "2026-10-05", "2026-10-06")).toHaveLength(2);
  });

  it("calcule les dates sans se tromper au changement d'heure", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(parseChapitres("1. Intro\n- Chap A\n\nchap a\n• Chap B")).toEqual(["Intro", "Chap A", "Chap B"]);
  });
});

describe("flashcards (Leitner)", () => {
  it("monte d'une boîte quand on sait, redescend sinon", () => {
    const now = new Date(2026, 9, 7, 15).getTime();
    let c = newCard("Q", "R");
    c = answer(c, true, now);
    expect(c.boite).toBe(1);
    expect(c.prochaine).toBe(new Date(2026, 9, 8).getTime());
    c = answer(c, false, now);
    expect(c).toMatchObject({ boite: 0, revues: 2, reussites: 1, prochaine: now });
  });

  it("calcule les statistiques et l'ordre de passage", () => {
    const now = Date.now();
    const a = { ...newCard("A", "1"), boite: 5, revues: 6, reussites: 6, prochaine: now + 1e9 };
    const b = { ...newCard("B", "2"), boite: 1, revues: 2, reussites: 1, prochaine: now - 1 };
    const c = newCard("C", "3");
    expect(deckStats([a, b, c], now)).toMatchObject({ total: 3, nouvelles: 1, maitrisees: 1, aRevoir: 1, dues: 2, progression: 33 });
    expect(sessionQueue([a, b, c], now)).toEqual([b.id, c.id]);
    expect(sessionQueue([a, b, c], now, true)).toHaveLength(3);
  });
});

// localStorage minimal en mémoire (les tests tournent sous Node).
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

describe("documents et sauvegarde", () => {
  beforeEach(() => localStorage.clear());

  it("mélange les réponses en gardant la bonne", () => {
    const q = shuffleChoices({ id: "q", question: "?", choix: ["a", "b", "c", "d"], bonne: 2, explication: "" }, () => 0);
    expect(q.choix[q.bonne]).toBe("c");
    const quiz = quizFromIA({ titre: "T", questions: [{ question: "?", choix: ["x", "y"], bonneReponse: 1, explication: "" }] }, "facile");
    expect(quiz.questions[0].choix[quiz.questions[0].bonne]).toBe("y");
  });

  it("enregistre, relit et répare un document", () => {
    const fiche = ficheFromIA({ titre: "Atomes", sousTitre: "", blocs: [{ type: "definition", titre: "Atome", contenu: "…" }] });
    saveDoc(fiche);
    expect(listDocs()[0]).toMatchObject({ id: fiche.id, type: "fiche", info: "1 bloc" });
    expect(loadDoc(fiche.id)).toEqual(fiche);
    expect(normalizeDoc({ type: "quiz", questions: [{ question: "?", choix: ["a", "b"], bonne: 7 }] })).toMatchObject({ questions: [] });
    expect(normalizeDoc({ type: "autre" })).toBeNull();
  });

  it("supprime un classeur complet et peut tout restaurer", () => {
    const cl = createClasseur({ nom: "SVT", cours: "Les volcans" });
    const fiche = { ...ficheFromIA({ titre: "Volcans", sousTitre: "", blocs: [] }), classeurId: cl.id };
    saveDoc(fiche);
    const map = createMap("Volcans");
    linkMap(map.id, cl.id);
    const autre = createMap("Autre");
    expect(
      listLibrary()
        .map((i) => i.kind)
        .sort(),
    ).toEqual(["carte", "carte", "classeur", "fiche"]);

    const snap = deleteClasseurDeep(cl.id);
    expect(listLibrary().map((i) => i.id)).toEqual([autre.id]);
    restore(snap);
    expect(listLibrary()).toHaveLength(4);
    expect(listMaps()).toHaveLength(2);
  });

  it("exporte puis réimporte toutes les données", () => {
    const cl = createClasseur({ nom: "Histoire", sujet: "La Révolution" });
    saveDoc({ ...ficheFromIA({ titre: "1789", sousTitre: "", blocs: [] }), classeurId: cl.id });
    createMap("Carte");
    const backup = JSON.parse(JSON.stringify(exportAll()));
    localStorage.clear();
    expect(importAll(backup)).toEqual({ cartes: 1, documents: 1, classeurs: 1 });
    expect(listLibrary()).toHaveLength(3);
    // Une seconde fois : rien de plus récent, rien n'est dupliqué.
    importAll(backup);
    expect(listLibrary()).toHaveLength(3);
    expect(() => importAll({ format: "autre" })).toThrow(/sauvegarde/);
  });
});
