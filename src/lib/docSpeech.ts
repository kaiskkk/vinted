// Ce que la lecture à voix haute lit pour chaque type de document, dans un ordre naturel.
import type { StudyDoc } from "./docs";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const join = (...parts: (string | undefined)[]) => parts.filter((p) => p && p.trim()).join(". ");

export function docSegments(doc: StudyDoc): string[] {
  const out: string[] = [doc.titre];
  switch (doc.type) {
    case "fiche":
      if (doc.sousTitre) out.push(doc.sousTitre);
      for (const b of doc.blocs) out.push(join(b.titre, b.contenu));
      break;
    case "revision":
      for (const s of doc.essentiel) out.push(join(s.titre, ...s.points));
      if (doc.top10.length) out.push("Les choses à savoir absolument");
      doc.top10.forEach((t, i) => out.push(join(`Numéro ${i + 1}`, t.texte, t.detail)));
      if (doc.pieges.length) out.push(join("Les pièges à éviter", ...doc.pieges));
      break;
    case "planning":
      for (const j of doc.jours) out.push(join(j.date, ...j.taches.map((t) => t.texte)));
      break;
    case "quiz":
      doc.questions.forEach((q, i) => out.push(join(`Question ${i + 1}`, q.question, ...q.choix.map((c, k) => `Réponse ${LETTERS[k]} : ${c}`))));
      break;
    case "flashcards":
      for (const c of doc.cartes) out.push(join(c.recto, `Réponse : ${c.verso}`));
      break;
    case "resume":
      out.push(doc.introduction);
      for (const s of doc.sections) out.push(join(s.titre, s.texte));
      out.push(doc.conclusion);
      break;
    case "frise":
      for (const e of doc.evenements) out.push(join(`${e.date} : ${e.titre}`, e.description));
      break;
    case "redaction":
      out.push(doc.sujet);
      if (doc.plan) {
        if (doc.plan.problematiques.length) out.push(join("Problématiques possibles", ...doc.plan.problematiques));
        doc.plan.parties.forEach((p, i) => {
          out.push(`Partie ${i + 1} : ${p.titre}`);
          for (const s of p.sousParties) out.push(join(s.titre, ...s.idees));
        });
      }
      break;
    case "exercices":
      doc.exercices.forEach((e, i) => out.push(join(`Exercice ${i + 1}`, e.titre, e.enonce)));
      break;
    case "jeu":
      for (const p of doc.paires) out.push(join(p.terme, p.definition));
      break;
    case "copie":
      out.push(join(doc.note && `Note : ${doc.note}`, doc.bilan));
      doc.erreurs.forEach((e, i) => out.push(join(`Erreur ${i + 1}`, e.explication, `Correction : ${e.correction}`, e.conseil)));
      break;
    case "oral":
      doc.questions.forEach((q, i) => out.push(join(`Question ${i + 1}`, q.question, `Réponse : ${q.reponse}`)));
      break;
  }
  return out.filter((t) => t && t.trim());
}
