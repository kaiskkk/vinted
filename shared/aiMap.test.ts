import { describe, expect, it } from "vitest";
import { firstEmoji, normalizeHex, sanitizeAiMap } from "./aiMap";

describe("normalizeHex", () => {
  it("accepte les formats courants", () => {
    expect(normalizeHex("#AABBCC")).toBe("#aabbcc");
    expect(normalizeHex("abc")).toBe("#aabbcc");
    expect(normalizeHex(" #123456 ")).toBe("#123456");
  });
  it("rejette le reste", () => {
    expect(normalizeHex("rouge")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex(42)).toBeNull();
  });
});

describe("firstEmoji", () => {
  it("garde un seul emoji, même composé", () => {
    expect(firstEmoji("⚽🏆")).toBe("⚽");
    expect(firstEmoji("👨‍👩‍👧 famille")).toBe("👨‍👩‍👧");
    expect(firstEmoji("🇫🇷")).toBe("🇫🇷");
  });
  it("ignore le texte sans emoji", () => {
    expect(firstEmoji("ballon")).toBe("");
    expect(firstEmoji(undefined)).toBe("");
  });
});

describe("sanitizeAiMap — remplacement", () => {
  it("garantit un seul nœud central et rattache les orphelins", () => {
    const out = sanitizeAiMap({
      titre: "Foot",
      noeuds: [
        { id: "n1", texte: "Devenir pro", parentId: null, couleur: "#111111", emoji: "⚽" },
        { id: "n2", texte: "Physique", parentId: "n1", couleur: "#ff0000", emoji: "" },
        { id: "n3", texte: "Autre racine", parentId: null, couleur: "#00ff00", emoji: "" },
        { id: "n4", texte: "Parent inconnu", parentId: "zzz", couleur: "", emoji: "" },
      ],
    });
    const roots = out.noeuds.filter((n) => n.parentId === null);
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe("n1");
    expect(out.noeuds.find((n) => n.id === "n3")!.parentId).toBe("n1");
    expect(out.noeuds.find((n) => n.id === "n4")!.parentId).toBe("n1");
  });

  it("crée un nœud central s'il manque et casse les cycles", () => {
    const out = sanitizeAiMap({
      titre: "Cycle",
      noeuds: [
        { id: "a", texte: "A", parentId: "b", couleur: "#123456", emoji: "" },
        { id: "b", texte: "B", parentId: "a", couleur: "#123456", emoji: "" },
      ],
    });
    const root = out.noeuds.find((n) => n.parentId === null)!;
    expect(root.texte).toBe("Cycle");
    // Chaque nœud doit remonter jusqu'à la racine.
    const byId = new Map(out.noeuds.map((n) => [n.id, n]));
    for (const n of out.noeuds) {
      let cur = n;
      let steps = 0;
      while (cur.parentId !== null && steps++ < 10) cur = byId.get(cur.parentId)!;
      expect(cur.id).toBe(root.id);
    }
  });

  it("supprime les textes vides, dédoublonne les ids et complète les couleurs", () => {
    const out = sanitizeAiMap({
      titre: "T",
      noeuds: [
        { id: "r", texte: "Racine", parentId: null, couleur: "nope", emoji: "" },
        { id: "x", texte: "Un", parentId: "r", couleur: "", emoji: "" },
        { id: "x", texte: "Deux", parentId: "r", couleur: "", emoji: "" },
        { id: "y", texte: "   ", parentId: "r", couleur: "", emoji: "" },
      ],
    });
    expect(out.noeuds.map((n) => n.texte)).toEqual(["Racine", "Un", "Deux"]);
    expect(new Set(out.noeuds.map((n) => n.id)).size).toBe(3);
    for (const n of out.noeuds) expect(n.couleur).toMatch(/^#[0-9a-f]{6}$/);
    // Deux branches principales → deux couleurs différentes.
    expect(out.noeuds[1].couleur).not.toBe(out.noeuds[2].couleur);
  });

  it("résiste à une entrée invalide", () => {
    const out = sanitizeAiMap("n'importe quoi");
    expect(out.noeuds).toHaveLength(1);
    expect(out.noeuds[0].parentId).toBeNull();
  });
});

describe("sanitizeAiMap — ajout et développement", () => {
  const existingIds = ["n1", "n2", "n3"];

  it("ignore les nœuds existants recopiés et rattache les orphelins au point de repli", () => {
    const out = sanitizeAiMap(
      {
        titre: "T",
        noeuds: [
          { id: "n2", texte: "Déjà là", parentId: "n1", couleur: "#000000", emoji: "" },
          { id: "x1", texte: "Nouveau", parentId: "n2", couleur: "#ff0000", emoji: "" },
          { id: "x2", texte: "Sous nouveau", parentId: "x1", couleur: "#ff0000", emoji: "" },
          { id: "x3", texte: "Perdu", parentId: "inconnu", couleur: "#ff0000", emoji: "" },
        ],
      },
      { existingIds, fallbackParentId: "n1" },
    );
    expect(out.noeuds.map((n) => n.id)).toEqual(["x1", "x2", "x3"]);
    expect(out.noeuds.find((n) => n.id === "x1")!.parentId).toBe("n2");
    expect(out.noeuds.find((n) => n.id === "x2")!.parentId).toBe("x1");
    expect(out.noeuds.find((n) => n.id === "x3")!.parentId).toBe("n1");
  });

  it("en mode développer, force le rattachement sous le nœud ciblé", () => {
    const out = sanitizeAiMap(
      {
        titre: "T",
        noeuds: [
          { id: "x1", texte: "A", parentId: "n3", couleur: "#ff0000", emoji: "" },
          { id: "x2", texte: "B", parentId: "n1", couleur: "#ff0000", emoji: "" },
          { id: "x3", texte: "C", parentId: "x1", couleur: "#ff0000", emoji: "" },
        ],
      },
      { existingIds, onlyUnder: "n3", maxNodes: 12 },
    );
    expect(out.noeuds.map((n) => n.parentId)).toEqual(["n3", "n3", "x1"]);
  });
});
