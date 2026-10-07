import { describe, expect, it } from "vitest";
import { cleanText, sanitizeFiche, sanitizeFlashcards, sanitizeQuestion, sanitizeQuiz, sanitizeResume, sanitizeRevision } from "./study";

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
