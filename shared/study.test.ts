import { describe, expect, it } from "vitest";
import {
  cleanText,
  sanitizeFrise,
  sanitizePlan,
  sanitizeRelecture,
  sanitizeFiche,
  sanitizeFlashcards,
  sanitizeQuestion,
  sanitizeQuiz,
  sanitizeResume,
  sanitizeRevision,
} from "./study";

describe("nettoyage des documents d'étude", () => {
  it("nettoie le texte", () => {
    expect(cleanText("  a\r\nb  \n\n\n\nc ", 100)).toBe("a\nb\n\nc");
    expect(cleanText(42, 10)).toBe("");
    expect(cleanText("abcdef", 3)).toBe("abc");
  });

  it("répare une fiche : type inconnu → texte, blocs vides retirés", () => {
    const fiche = sanitizeFiche({
      titre: "  ",
      blocs: [{ type: "definition", titre: "Atome", contenu: "Plus petite partie" }, { type: "bizarre", contenu: "x" }, { type: "date" }, null],
    });
    expect(fiche.titre).toBe("Fiche de cours");
    expect(fiche.blocs.map((b) => b.type)).toEqual(["definition", "texte"]);
    const variantes = sanitizeFiche({ blocs: ["Définition", "PIÈGE", "À retenir", "Notion clé"].map((type) => ({ type, contenu: "x" })) });
    expect(variantes.blocs.map((b) => b.type)).toEqual(["definition", "piege", "retenir", "notion"]);
  });

  it("suit la bonne réponse quand des choix sont retirés", () => {
    const q = sanitizeQuestion({ question: "2 + 2 ?", choix: ["3", "", "3", "4"], bonneReponse: 3, explication: "" });
    expect(q).toEqual({ question: "2 + 2 ?", choix: ["3", "4"], bonneReponse: 1, explication: "" });
    expect(sanitizeQuestion({ question: "x", choix: ["a", "b"], bonneReponse: 5 })).toBeNull();
    expect(sanitizeQuestion({ question: "x", choix: ["a", "a"], bonneReponse: 1 })).toBeNull();
    expect(sanitizeQuestion({ question: "", choix: ["a", "b"], bonneReponse: 0 })).toBeNull();
  });

  it("retire les questions et cartes en double", () => {
    const quiz = sanitizeQuiz({
      questions: [
        { question: "Capitale ?", choix: ["Paris", "Lyon"], bonneReponse: 0 },
        { question: "capitale ?", choix: ["Paris", "Lyon"], bonneReponse: 0 },
      ],
    });
    expect(quiz.questions).toHaveLength(1);
    const cartes = sanitizeFlashcards({ cartes: [{ recto: "A", verso: "1" }, { recto: "a", verso: "2" }, { recto: "B" }] });
    expect(cartes.cartes).toEqual([{ recto: "A", verso: "1" }]);
  });

  it("répare et trie une frise", () => {
    const f = sanitizeFrise({
      evenements: [
        { annee: 1914, mois: 7, date: "28 juillet 1914", titre: "Début de la guerre" },
        { annee: -52, mois: 0, titre: "Alésia" },
        { annee: "1918", titre: "Année en texte" },
        { annee: 1789, titre: "" },
      ],
      periodes: [{ titre: "Guerre", debut: 1918, fin: 1914 }],
    });
    expect(f.evenements.map((e) => e.titre)).toEqual(["Alésia", "Début de la guerre"]);
    expect(f.evenements[0].date).toBe("52 av. J.-C.");
    expect(f.periodes).toEqual([{ titre: "Guerre", debut: 1914, fin: 1918 }]);
  });

  it("répare un plan et une relecture", () => {
    const p = sanitizePlan({
      problematiques: ["A ?", "A ?"],
      parties: [{ titre: "I", sousParties: [{ titre: "1", idees: ["x"], exemples: "non" }] }, { titre: "" }],
    });
    expect(p.problematiques).toEqual(["A ?"]);
    expect(p.parties).toEqual([{ titre: "I", sousParties: [{ titre: "1", idees: ["x"], exemples: [] }] }]);
    expect(p.conclusion).toEqual({ bilan: "", ouverture: "" });
    const r = sanitizeRelecture({
      appreciation: "Bien",
      aAmeliorer: [{ extrait: "x" }, { probleme: "P", conseil: "C" }],
      langue: [{ extrait: "a" }],
    });
    expect(r.aAmeliorer).toEqual([{ extrait: "", probleme: "P", conseil: "C" }]);
    expect(r.langue).toEqual([]);
  });

  it("répare la révision et le résumé", () => {
    const rev = sanitizeRevision({
      essentiel: [
        { titre: "T", points: ["p", "p", ""] },
        { titre: "Vide", points: [] },
      ],
      top10: ["Un", { texte: "Deux" }],
      pieges: "non",
    });
    expect(rev.essentiel).toEqual([{ titre: "T", points: ["p"] }]);
    expect(rev.top10).toEqual([
      { texte: "Un", detail: "" },
      { texte: "Deux", detail: "" },
    ]);
    expect(rev.pieges).toEqual([]);
    const res = sanitizeResume({
      sections: [
        { titre: "A", texte: "" },
        { titre: "B", texte: "Texte" },
      ],
    });
    expect(res.sections).toEqual([{ titre: "B", texte: "Texte" }]);
    expect(res.titre).toBe("Résumé");
  });
});

describe("exercices, jeux et copies", () => {
  it("garde les exercices complets", async () => {
    const { sanitizeExercices } = await import("./study");
    const r = sanitizeExercices({
      titre: "  ",
      exercices: [
        { titre: "Ex 1", enonce: "Calcule 2 + 3.", indices: ["Additionne", "Additionne"], etapes: ["2 + 3 = 5"], reponse: "5" },
        { enonce: "Sans correction", etapes: [] },
        { enonce: "", etapes: ["x"] },
      ],
    });
    expect(r.titre).toBe("Exercices");
    expect(r.exercices).toEqual([{ titre: "Ex 1", enonce: "Calcule 2 + 3.", indices: ["Additionne"], etapes: ["2 + 3 = 5"], reponse: "5" }]);
  });

  it("nettoie les jeux : paires, trous entre crochets, mots croisés d'un seul mot", async () => {
    const { sanitizeJeu, crosswordWord } = await import("./study");
    const j = sanitizeJeu({
      paires: [
        { terme: "Magma", definition: "Roche fondue" },
        { terme: "magma", definition: "Doublon" },
        { terme: "", definition: "x" },
      ],
      trous: [{ texte: "Le [magma] remonte." }, { texte: "Pas de trou ici." }, "La [lave] coule."],
      motsCroises: [
        { mot: "Éruption", indice: "Sortie de lave" },
        { mot: "Al", indice: "Trop court" },
        { mot: "Plaque tectonique", indice: "Deux mots : PLAQUETECTONIQUE (16 lettres, trop long)" },
        { mot: "Cratère", indice: "Ouverture du volcan" },
      ],
    });
    expect(j.paires).toEqual([{ terme: "Magma", definition: "Roche fondue" }]);
    expect(j.trous.map((t) => t.texte)).toEqual(["Le [magma] remonte.", "La [lave] coule."]);
    expect(j.motsCroises.map((m) => crosswordWord(m.mot))).toEqual(["ERUPTION", "CRATERE"]);
  });

  it("nettoie l'analyse d'une copie", async () => {
    const { sanitizeCopie } = await import("./study");
    const c = sanitizeCopie({
      note: "12/20",
      erreurs: [
        { extrait: "x", explication: "", correction: "" },
        { explication: "Faux", correction: "Vrai" },
      ],
      exercices: [{ enonce: "E", etapes: ["S"] }],
    });
    expect(c.titre).toBe("Ma copie");
    expect(c.erreurs).toHaveLength(1);
    expect(c.exercices).toHaveLength(1);
  });
});
