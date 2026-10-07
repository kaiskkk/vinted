// Planning de révision jour par jour, calculé sur l'appareil (pas besoin de Claude) :
// chaque chapitre est appris un jour, puis revu à J+1, J+3 et J+7 (répétition espacée),
// la veille de l'examen est réservée à un bilan général.
import { newId } from "./mapModel";
import type { PlanningJour, PlanningTache } from "./docs";

const DAY = 86_400_000;
const MAX_PAR_JOUR = 4;
const MAX_JOURS = 366;

/** Date locale au format AAAA-MM-JJ. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Midi local : évite les surprises des changements d'heure. */
export const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

export const addDays = (s: string, n: number) => isoDay(new Date(parseDay(s).getTime() + n * DAY));

export const daysBetween = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY);

export const today = () => isoDay(new Date());

const tache = (texte: string, genre: PlanningTache["genre"], chapitre?: string): PlanningTache => ({
  id: newId(),
  texte,
  genre,
  fait: false,
  ...(chapitre ? { chapitre } : {}),
});

/** Nettoie la liste des chapitres saisie par l'élève (une ligne par chapitre). */
export function parseChapitres(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/\n|;/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((l) => {
      const key = l.toLowerCase();
      if (!l || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}

export function buildPlanning(chapitresIn: string[], debut: string, dateExamen: string): PlanningJour[] {
  const total = daysBetween(debut, dateExamen);
  if (!Number.isFinite(total) || total < 1) throw new Error("La date d'examen doit être au plus tôt demain.");
  if (total > MAX_JOURS) throw new Error("Choisis une date d'examen dans moins d'un an.");
  const chapitres = chapitresIn.length ? chapitresIn : ["Tout le programme"];

  const jours: PlanningJour[] = Array.from({ length: total }, (_, i) => ({ date: addDays(debut, i), taches: [] }));
  // Jours d'apprentissage et de révision ; le dernier jour avant l'examen sert au bilan.
  const travail = total >= 2 ? total - 1 : 1;
  const apprentissage = Math.max(1, Math.min(travail, Math.ceil(travail * 0.6), chapitres.length));
  const span = Math.max(apprentissage, Math.min(travail, Math.ceil(travail * 0.6)));

  const placer = (jour: number, t: PlanningTache) => {
    let j = jour;
    while (j < travail - 1 && jours[j].taches.length >= MAX_PAR_JOUR) j++;
    jours[Math.min(j, travail - 1)].taches.push(t);
  };

  chapitres.forEach((c, i) => {
    const d = Math.floor((i * span) / chapitres.length);
    jours[d].taches.push(tache(`Apprendre : ${c}`, "apprendre", c));
    let revisions = [1, 3, 7].map((k) => d + k).filter((x) => x < travail);
    if (revisions.length === 0 && d < travail - 1) revisions = [travail - 1];
    revisions.forEach((r, k) =>
      placer(r, tache(k === revisions.length - 1 && k > 0 ? `Réviser : ${c} (quiz ou flashcards)` : `Réviser : ${c}`, "reviser", c)),
    );
  });

  if (total >= 2) {
    jours[total - 1].taches.push(
      tache("Bilan : relis tes fiches de révision et les 10 choses à savoir", "bilan"),
      tache("Bilan : fais un quiz complet et revois tes erreurs", "bilan"),
    );
  }
  jours.push({ date: dateExamen, taches: [tache("Jour J : bonne chance ! Dors bien la veille 🍀", "examen")] });
  return jours;
}
