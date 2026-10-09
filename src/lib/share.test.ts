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

const { buildPayload, importShared, randomShareId } = await import("./share");
const docs = await import("./docs");
const { createMap, loadMap } = await import("./storage");

describe("partage par lien", () => {
  beforeEach(() => localStorage.clear());

  it("identifiants impossibles à deviner", () => {
    const ids = new Set(Array.from({ length: 200 }, randomShareId));
    expect(ids.size).toBe(200);
    expect([...ids].every((id) => /^[A-Za-z0-9]{20}$/.test(id))).toBe(true);
  });

  it("partage une copie sans la progression personnelle", () => {
    const deck = docs.flashcardsFromIA({ titre: "Volcans", cartes: [{ recto: "Magma ?", verso: "Roche fondue" }] });
    deck.cartes[0] = { ...deck.cartes[0], boite: 4, revues: 9, reussites: 7 };
    docs.saveDoc({ ...deck, classeurId: "c1" });
    const payload = buildPayload("flashcards", deck.id);
    const shared = JSON.parse(payload.data);
    expect(payload).toMatchObject({ kind: "flashcards", titre: "Volcans" });
    expect(shared.classeurId).toBeUndefined();
    expect(shared.cartes[0]).toMatchObject({ recto: "Magma ?", boite: 0, revues: 0, reussites: 0 });

    const devoir = {
      ...docs.newRedaction({ typeDevoir: "dissertation", sujet: "Le bonheur", matiere: "", document: "" }),
      brouillon: "Mon texte à moi",
    };
    docs.saveDoc(devoir);
    expect(JSON.parse(buildPayload("redaction", devoir.id).data)).toMatchObject({ sujet: "Le bonheur", brouillon: "", relectures: [] });
  });

  it("ajoute la copie reçue avec un nouvel identifiant", () => {
    const quiz = docs.quizFromIA({ titre: "Quiz", questions: [{ question: "?", choix: ["a", "b"], bonneReponse: 0, explication: "" }] }, "facile");
    docs.saveDoc({ ...quiz, tentatives: [{ date: 1, score: 1, total: 1 }] });
    const payload = buildPayload("quiz", quiz.id);
    localStorage.clear(); // l'ami n'a rien
    const { kind, id } = importShared(payload);
    expect(kind).toBe("quiz");
    expect(id).not.toBe(quiz.id);
    const copy = docs.loadDoc(id);
    expect(copy).toMatchObject({ type: "quiz", titre: "Quiz", tentatives: [] });
    expect(docs.listDocs().map((d) => d.id)).toEqual([id]);
  });

  it("partage un classeur entier avec ses documents et ses cartes", () => {
    const c = docs.createClasseur({ nom: "SVT", cours: "Le cours" });
    const fiche = { ...docs.blankFiche("Fiche SVT"), classeurId: c.id };
    docs.saveDoc(fiche);
    const map = createMap("Carte SVT");
    docs.linkMap(map.id, c.id);
    const payload = buildPayload("classeur", c.id);
    localStorage.clear();
    const { kind, id } = importShared(payload);
    expect(kind).toBe("classeur");
    expect(docs.loadClasseur(id)).toMatchObject({ nom: "SVT", cours: "Le cours", chat: [] });
    expect(docs.docsOfClasseur(id).map((d) => d.titre)).toEqual(["Fiche SVT"]);
    const maps = docs.mapIdsOfClasseur(id);
    expect(maps).toHaveLength(1);
    expect(loadMap(maps[0])?.name).toBe("Carte SVT");
    expect(maps[0]).not.toBe(map.id);
  });

  it("refuse ce qui n'existe pas", () => {
    expect(() => buildPayload("fiche", "inconnu")).toThrow(/introuvable/);
  });
});
