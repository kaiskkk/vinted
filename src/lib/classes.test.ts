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

const classes = await import("./classes");
const docs = await import("./docs");
const { isSyncedKey } = await import("./sync");

describe("mode classe", () => {
  beforeEach(() => localStorage.clear());

  it("codes de 8 caractères sans lettres ambiguës", () => {
    const codes = new Set(Array.from({ length: 300 }, classes.randomCode));
    expect(codes.size).toBe(300);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{8}$/);
      expect(c).not.toMatch(/[ILO01]/);
    }
  });

  it("lit un code tapé, collé ou dans un lien", () => {
    expect(classes.formatCode("ABCDEF23")).toBe("ABCD-EF23");
    expect(classes.parseCode("abcd-ef23")).toBe("ABCDEF23");
    expect(classes.parseCode("  ABCD EF23 ")).toBe("ABCDEF23");
    expect(classes.parseCode("https://ecoleducc.vercel.app/#/classe/ABCDEF23")).toBe("ABCDEF23");
    expect(classes.parseCode("ABCD-EF2")).toBeNull();
    // O et 0 n'existent pas dans les codes : pas de confusion possible.
    expect(classes.parseCode("ABCD-EF0O")).toBeNull();
  });

  it("garde mes classes sur l'appareil, synchronisées avec le compte", () => {
    classes.saveMaClasse({ code: "ABCDEF23", nom: "3e B", createur: true, peutPartager: true, rejointLe: 1, updatedAt: 0, vu: 0, imports: {} });
    classes.saveMaClasse({
      code: "ZZZZ2222",
      nom: "Groupe bac",
      createur: false,
      peutPartager: false,
      rejointLe: 2,
      updatedAt: 0,
      vu: 5,
      imports: {},
    });
    expect(classes.listMesClasses().map((c) => c.nom)).toEqual(["Groupe bac", "3e B"]);
    expect(classes.getMaClasse("ZZZZ2222")).toMatchObject({ peutPartager: false, vu: 5, createur: false });
    expect(isSyncedKey("ed-groupe:ABCDEF23")).toBe(true);
    expect(isSyncedKey("ed-prenom")).toBe(true);
    classes.removeMaClasse("ABCDEF23");
    expect(classes.listMesClasses()).toHaveLength(1);
    expect(classes.parseMaClasse("pas du json", "X")).toBeNull();
  });

  it("ouvre un document de la classe une seule fois (la copie est réutilisée)", () => {
    classes.saveMaClasse({ code: "ABCDEF23", nom: "3e B", createur: false, peutPartager: true, rejointLe: 1, updatedAt: 0, vu: 0, imports: {} });
    const fiche = docs.blankFiche("Les volcans");
    const shared = {
      id: "d1",
      kind: "fiche" as const,
      titre: fiche.titre,
      data: JSON.stringify(fiche),
      auteur: "prof",
      auteurNom: "M. Dupont",
      createdAt: 10,
    };
    const exists = (_k: string, id: string) => docs.loadDoc(id) !== null;
    const first = classes.importFromClasse("ABCDEF23", shared, exists);
    const again = classes.importFromClasse("ABCDEF23", shared, exists);
    expect(again).toEqual(first);
    expect(first.id).not.toBe(fiche.id);
    expect(docs.listDocs()).toHaveLength(1);
    // Copie supprimée chez moi : une nouvelle copie est créée.
    docs.deleteDoc(first.id);
    const third = classes.importFromClasse("ABCDEF23", shared, exists);
    expect(third.id).not.toBe(first.id);
    expect(classes.getMaClasse("ABCDEF23")?.imports.d1).toEqual(third);
  });
});
