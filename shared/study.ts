// Formats des documents d'étude produits par Claude (fiche, révision, quiz, flashcards, résumé),
// partagés entre le serveur (nettoyage des réponses) et le front (affichage, import).

export type Niveau = "college" | "lycee" | "superieur";
export const NIVEAUX: { value: Niveau; label: string; court: string }[] = [
  { value: "college", label: "Collège", court: "Collège" },
  { value: "lycee", label: "Lycée", court: "Lycée" },
  { value: "superieur", label: "Études supérieures", court: "Études sup" },
];
export const isNiveau = (v: unknown): v is Niveau => NIVEAUX.some((n) => n.value === v);

export type Difficulte = "facile" | "moyen" | "difficile";
export const DIFFICULTES: { value: Difficulte; label: string }[] = [
  { value: "facile", label: "Facile" },
  { value: "moyen", label: "Moyen" },
  { value: "difficile", label: "Difficile" },
];

/** Types de documents que Claude sait générer à partir d'un cours. */
export type TypeEtude = "fiche" | "revision" | "quiz" | "flashcards" | "resume" | "frise" | "exercices" | "jeu" | "oral";
export const TYPES_ETUDE: TypeEtude[] = ["fiche", "revision", "quiz", "flashcards", "resume", "frise", "exercices", "jeu", "oral"];

/** Longueur maximale du cours envoyé à Claude (environ 15 000 mots). */
export const SOURCE_MAX = 60_000;

// ---------- Fiche ----------

export type BlocType = "notion" | "definition" | "date" | "formule" | "exemple" | "piege" | "retenir" | "texte";
export const BLOC_TYPES: BlocType[] = ["notion", "definition", "date", "formule", "exemple", "piege", "retenir", "texte"];

export interface FicheIA {
  titre: string;
  sousTitre: string;
  blocs: { type: BlocType; titre: string; contenu: string }[];
}

// ---------- Révision ----------

export interface RevisionIA {
  titre: string;
  essentiel: { titre: string; points: string[] }[];
  top10: { texte: string; detail: string }[];
  pieges: string[];
}

// ---------- Quiz ----------

export interface QuestionIA {
  question: string;
  choix: string[];
  bonneReponse: number;
  explication: string;
}
export interface QuizIA {
  titre: string;
  questions: QuestionIA[];
}

// ---------- Flashcards ----------

export interface FlashcardsIA {
  titre: string;
  cartes: { recto: string; verso: string }[];
}

// ---------- Résumé ----------

export interface ResumeIA {
  titre: string;
  introduction: string;
  sections: { titre: string; texte: string }[];
  conclusion: string;
}

// ---------- Frise chronologique ----------

export interface EvenementIA {
  /** Année (négative avant J.-C.), pour placer l'événement. */
  annee: number;
  /** Mois de 1 à 12, ou 0 s'il n'a pas de sens. */
  mois: number;
  /** Date lisible : « 14 juillet 1789 », « vers 3000 av. J.-C. »… */
  date: string;
  titre: string;
  description: string;
}
export interface FriseIA {
  titre: string;
  periodes: { titre: string; debut: number; fin: number }[];
  evenements: EvenementIA[];
}

// ---------- Exercices ----------

export interface ExerciceIA {
  titre: string;
  enonce: string;
  /** Indices de plus en plus précis, dévoilés un par un. */
  indices: string[];
  /** Correction étape par étape. */
  etapes: string[];
  /** Résultat final, court. */
  reponse: string;
}
export interface ExercicesIA {
  titre: string;
  exercices: ExerciceIA[];
}

// ---------- Jeux de révision ----------

export interface JeuIA {
  titre: string;
  /** Jeu des paires : un terme et sa définition (ou une date et son événement). */
  paires: { terme: string; definition: string }[];
  /** Textes à trous : les mots à retrouver sont entre crochets, « Le [magma] remonte… ». */
  trous: { texte: string }[];
  /** Mots croisés : un mot (lettres seulement) et son indice. */
  motsCroises: { mot: string; indice: string }[];
}

// ---------- Interrogation orale ----------

export interface OralQuestionIA {
  /** Question ouverte, lue à voix haute. */
  question: string;
  /** Réponse attendue, en 1 à 3 phrases. */
  reponse: string;
  /** Éléments que la réponse doit contenir. */
  points: string[];
}
export interface OralIA {
  titre: string;
  questions: OralQuestionIA[];
}

/** Correction d'une réponse donnée à l'oral. */
export type Verdict = "juste" | "partiel" | "faux";
export const VERDICTS: Verdict[] = ["juste", "partiel", "faux"];
export interface CorrectionOraleIA {
  verdict: Verdict;
  /** Retour adressé à l'élève, lisible à voix haute. */
  retour: string;
  /** Éléments attendus qui manquaient ou étaient faux. */
  manque: string[];
}

export type EtudeIA = FicheIA | RevisionIA | QuizIA | FlashcardsIA | ResumeIA | FriseIA | ExercicesIA | JeuIA | OralIA;

// ---------- Analyse d'une copie corrigée ----------

export interface CopieIA {
  titre: string;
  matiere: string;
  /** Note relevée sur la copie (« 12/20 »), ou "". */
  note: string;
  bilan: string;
  pointsForts: string[];
  erreurs: { extrait: string; explication: string; correction: string; conseil: string }[];
  notions: string[];
  /** Exercices d'entraînement ciblés sur les erreurs. */
  exercices: ExerciceIA[];
}

// ---------- Aide à la rédaction ----------

export type TypeDevoir = "dissertation" | "commentaire" | "expose" | "redaction";
export const TYPES_DEVOIR: { value: TypeDevoir; label: string; description: string }[] = [
  { value: "dissertation", label: "Dissertation", description: "Répondre à une question en argumentant" },
  { value: "commentaire", label: "Commentaire", description: "Analyser un texte ou un document" },
  { value: "expose", label: "Exposé", description: "Préparer une présentation orale" },
  { value: "redaction", label: "Rédaction", description: "Écrire un récit ou un texte d'invention" },
];
export const isTypeDevoir = (v: unknown): v is TypeDevoir => TYPES_DEVOIR.some((t) => t.value === v);

export interface PlanIA {
  problematiques: string[];
  introduction: { accroche: string; presentation: string; problematique: string; annonce: string };
  parties: { titre: string; sousParties: { titre: string; idees: string[]; exemples: string[] }[] }[];
  conclusion: { bilan: string; ouverture: string };
  conseils: string[];
}

export interface RelectureIA {
  appreciation: string;
  pointsForts: string[];
  aAmeliorer: { extrait: string; probleme: string; conseil: string }[];
  langue: { extrait: string; remarque: string }[];
  prochaineEtape: string;
}

// ---------- Nettoyage ----------

/** Texte propre : fins de ligne unifiées, espaces superflus retirés, longueur bornée. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
    .trim();
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function strings(v: unknown, maxItems: number, maxLen: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list(v)) {
    const s = cleanText(item, maxLen);
    const key = fold(s);
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

const BLOC_ALIASES: Record<string, BlocType> = {
  "notion cle": "notion",
  "notions cles": "notion",
  notions: "notion",
  definitions: "definition",
  dates: "date",
  formules: "formule",
  exemples: "exemple",
  pieges: "piege",
  "a retenir": "retenir",
  a_retenir: "retenir",
  texte: "texte",
};

/** Type de bloc reconnu malgré les accents, majuscules ou pluriels ; « texte » sinon. */
export function blocType(v: unknown): BlocType {
  if (typeof v !== "string") return "texte";
  const key = fold(v);
  if (BLOC_TYPES.includes(key as BlocType)) return key as BlocType;
  return BLOC_ALIASES[key] ?? "texte";
}

export function sanitizeFiche(raw: unknown): FicheIA {
  const r = obj(raw);
  const blocs = list(r.blocs)
    .map((b) => {
      const o = obj(b);
      const type = blocType(o.type);
      return { type, titre: cleanText(o.titre, 140), contenu: cleanText(o.contenu, 2000) };
    })
    .filter((b) => b.titre || b.contenu)
    .slice(0, 40);
  return { titre: cleanText(r.titre, 140) || "Fiche de cours", sousTitre: cleanText(r.sousTitre, 200), blocs };
}

export function sanitizeRevision(raw: unknown): RevisionIA {
  const r = obj(raw);
  const essentiel = list(r.essentiel)
    .map((s) => {
      const o = obj(s);
      return { titre: cleanText(o.titre, 120), points: strings(o.points, 10, 300) };
    })
    .filter((s) => s.points.length > 0)
    .slice(0, 10);
  const top10 = list(r.top10)
    .map((t) => {
      const o = typeof t === "string" ? { texte: t } : obj(t);
      return { texte: cleanText(o.texte, 300), detail: cleanText(o.detail, 400) };
    })
    .filter((t) => t.texte)
    .slice(0, 10);
  return {
    titre: cleanText(r.titre, 140) || "Fiche de révision",
    essentiel,
    top10,
    pieges: strings(r.pieges, 8, 300),
  };
}

export function sanitizeQuestion(raw: unknown): QuestionIA | null {
  const o = obj(raw);
  const question = cleanText(o.question, 600);
  const bonne = typeof o.bonneReponse === "number" ? Math.trunc(o.bonneReponse) : Number.NaN;
  if (!question) return null;
  // Choix vides ou en double retirés, en suivant la position de la bonne réponse.
  const seen = new Set<string>();
  const choix: string[] = [];
  let bonneReponse = -1;
  list(o.choix).forEach((c, i) => {
    const s = cleanText(c, 300);
    const key = fold(s);
    if (!s || seen.has(key) || choix.length >= 6) return;
    seen.add(key);
    if (i === bonne) bonneReponse = choix.length;
    choix.push(s);
  });
  if (choix.length < 2 || bonneReponse < 0) return null;
  return { question, choix, bonneReponse, explication: cleanText(o.explication, 1000) };
}

export function sanitizeQuiz(raw: unknown, maxQuestions = 40): QuizIA {
  const r = obj(raw);
  const seen = new Set<string>();
  const questions: QuestionIA[] = [];
  for (const q of list(r.questions)) {
    const clean = sanitizeQuestion(q);
    if (!clean || seen.has(fold(clean.question))) continue;
    seen.add(fold(clean.question));
    questions.push(clean);
    if (questions.length >= maxQuestions) break;
  }
  return { titre: cleanText(r.titre, 140) || "Quiz", questions };
}

export function sanitizeFlashcards(raw: unknown, maxCards = 80): FlashcardsIA {
  const r = obj(raw);
  const seen = new Set<string>();
  const cartes: FlashcardsIA["cartes"] = [];
  for (const c of list(r.cartes)) {
    const o = obj(c);
    const recto = cleanText(o.recto, 400);
    const verso = cleanText(o.verso, 1200);
    if (!recto || !verso || seen.has(fold(recto))) continue;
    seen.add(fold(recto));
    cartes.push({ recto, verso });
    if (cartes.length >= maxCards) break;
  }
  return { titre: cleanText(r.titre, 140) || "Flashcards", cartes };
}

export function sanitizeResume(raw: unknown): ResumeIA {
  const r = obj(raw);
  const sections = list(r.sections)
    .map((s) => {
      const o = obj(s);
      return { titre: cleanText(o.titre, 140), texte: cleanText(o.texte, 4000) };
    })
    .filter((s) => s.texte)
    .slice(0, 15);
  return {
    titre: cleanText(r.titre, 140) || "Résumé",
    introduction: cleanText(r.introduction, 2000),
    sections,
    conclusion: cleanText(r.conclusion, 2000),
  };
}

const year = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-100_000, Math.min(3000, Math.round(v))) : Number.NaN);

export function sanitizeFrise(raw: unknown): FriseIA {
  const r = obj(raw);
  const evenements = list(r.evenements)
    .map((e) => {
      const o = obj(e);
      const mois = typeof o.mois === "number" && o.mois >= 1 && o.mois <= 12 ? Math.round(o.mois) : 0;
      return { annee: year(o.annee), mois, date: cleanText(o.date, 80), titre: cleanText(o.titre, 140), description: cleanText(o.description, 800) };
    })
    .filter((e) => Number.isFinite(e.annee) && e.titre)
    .map((e) => ({ ...e, date: e.date || (e.annee < 0 ? `${-e.annee} av. J.-C.` : String(e.annee)) }))
    .sort((a, b) => a.annee - b.annee || a.mois - b.mois)
    .slice(0, 80);
  const periodes = list(r.periodes)
    .map((p) => {
      const o = obj(p);
      const a = year(o.debut);
      const b = year(o.fin);
      return { titre: cleanText(o.titre, 100), debut: Math.min(a, b), fin: Math.max(a, b) };
    })
    .filter((p) => p.titre && Number.isFinite(p.debut) && Number.isFinite(p.fin))
    .sort((a, b) => a.debut - b.debut)
    .slice(0, 12);
  return { titre: cleanText(r.titre, 140) || "Frise chronologique", periodes, evenements };
}

export function sanitizePlan(raw: unknown): PlanIA {
  const r = obj(raw);
  const intro = obj(r.introduction);
  const conclu = obj(r.conclusion);
  return {
    problematiques: strings(r.problematiques, 4, 400),
    introduction: {
      accroche: cleanText(intro.accroche, 500),
      presentation: cleanText(intro.presentation, 800),
      problematique: cleanText(intro.problematique, 400),
      annonce: cleanText(intro.annonce, 500),
    },
    parties: list(r.parties)
      .map((p) => {
        const o = obj(p);
        return {
          titre: cleanText(o.titre, 200),
          sousParties: list(o.sousParties)
            .map((sp) => {
              const x = obj(sp);
              return { titre: cleanText(x.titre, 200), idees: strings(x.idees, 6, 300), exemples: strings(x.exemples, 5, 300) };
            })
            .filter((sp) => sp.titre || sp.idees.length)
            .slice(0, 5),
        };
      })
      .filter((p) => p.titre)
      .slice(0, 5),
    conclusion: { bilan: cleanText(conclu.bilan, 800), ouverture: cleanText(conclu.ouverture, 500) },
    conseils: strings(r.conseils, 8, 400),
  };
}

export function sanitizeRelecture(raw: unknown): RelectureIA {
  const r = obj(raw);
  return {
    appreciation: cleanText(r.appreciation, 1200),
    pointsForts: strings(r.pointsForts, 6, 400),
    aAmeliorer: list(r.aAmeliorer)
      .map((a) => {
        const o = obj(a);
        return { extrait: cleanText(o.extrait, 200), probleme: cleanText(o.probleme, 400), conseil: cleanText(o.conseil, 600) };
      })
      .filter((a) => a.probleme || a.conseil)
      .slice(0, 10),
    langue: list(r.langue)
      .map((l) => {
        const o = obj(l);
        return { extrait: cleanText(o.extrait, 150), remarque: cleanText(o.remarque, 400) };
      })
      .filter((l) => l.remarque)
      .slice(0, 15),
    prochaineEtape: cleanText(r.prochaineEtape, 600),
  };
}

export function sanitizeExercice(raw: unknown): ExerciceIA | null {
  const o = obj(raw);
  const enonce = cleanText(o.enonce, 3000);
  const etapes = strings(o.etapes, 12, 1500);
  if (!enonce || !etapes.length) return null;
  return {
    titre: cleanText(o.titre, 140),
    enonce,
    indices: strings(o.indices, 4, 600),
    etapes,
    reponse: cleanText(o.reponse, 600),
  };
}

export function sanitizeExercices(raw: unknown, max = 20): ExercicesIA {
  const r = obj(raw);
  const exercices = list(r.exercices)
    .map(sanitizeExercice)
    .filter((e): e is ExerciceIA => e !== null)
    .slice(0, max);
  return { titre: cleanText(r.titre, 140) || "Exercices", exercices };
}

/** Mot de mots croisés : majuscules sans accents, lettres seulement (« Photosynthèse » → « PHOTOSYNTHESE »). */
export const crosswordWord = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

export function sanitizeJeu(raw: unknown): JeuIA {
  const r = obj(raw);
  const seenTerm = new Set<string>();
  const paires = list(r.paires)
    .map((p) => {
      const o = obj(p);
      return { terme: cleanText(o.terme, 80), definition: cleanText(o.definition, 220) };
    })
    .filter((p) => p.terme && p.definition && !seenTerm.has(fold(p.terme)) && (seenTerm.add(fold(p.terme)), true))
    .slice(0, 20);
  const trous = list(r.trous)
    .map((t) => ({ texte: cleanText(typeof t === "string" ? t : obj(t).texte, 400) }))
    // Au moins un mot à retrouver, entre crochets, pas trop long.
    .filter((t) => /\[[^\]\n]{1,40}\]/.test(t.texte))
    .slice(0, 15);
  const seenWord = new Set<string>();
  const motsCroises = list(r.motsCroises)
    .map((m) => {
      const o = obj(m);
      return { mot: cleanText(o.mot, 30), indice: cleanText(o.indice, 200) };
    })
    .filter((m) => {
      const w = crosswordWord(m.mot);
      if (w.length < 3 || w.length > 14 || !m.indice || seenWord.has(w)) return false;
      seenWord.add(w);
      return true;
    })
    .slice(0, 15);
  return { titre: cleanText(r.titre, 140) || "Jeux de révision", paires, trous, motsCroises };
}

export function sanitizeCopie(raw: unknown): CopieIA {
  const r = obj(raw);
  return {
    titre: cleanText(r.titre, 140) || "Ma copie",
    matiere: cleanText(r.matiere, 80),
    note: cleanText(r.note, 20),
    bilan: cleanText(r.bilan, 1500),
    pointsForts: strings(r.pointsForts, 6, 400),
    erreurs: list(r.erreurs)
      .map((e) => {
        const o = obj(e);
        return {
          extrait: cleanText(o.extrait, 300),
          explication: cleanText(o.explication, 800),
          correction: cleanText(o.correction, 800),
          conseil: cleanText(o.conseil, 500),
        };
      })
      .filter((e) => e.explication || e.correction)
      .slice(0, 20),
    notions: strings(r.notions, 8, 200),
    exercices: sanitizeExercices({ exercices: r.exercices }, 6).exercices,
  };
}

export function sanitizeOral(raw: unknown, max = 30): OralIA {
  const r = obj(raw);
  const seen = new Set<string>();
  const questions: OralQuestionIA[] = [];
  for (const q of list(r.questions)) {
    const o = typeof q === "string" ? { question: q } : obj(q);
    const question = cleanText(o.question, 500);
    const reponse = cleanText(o.reponse, 1500);
    if (!question || !reponse || seen.has(fold(question))) continue;
    seen.add(fold(question));
    questions.push({ question, reponse, points: strings(o.points, 5, 200) });
    if (questions.length >= max) break;
  }
  return { titre: cleanText(r.titre, 140) || "Interrogation orale", questions };
}

/** Verdict reconnu malgré les variantes (« Correct », « presque juste », « incorrect ») ; « faux » sinon. */
export function verdictOf(v: unknown): Verdict {
  if (typeof v !== "string") return "faux";
  const s = fold(v);
  if (/partiel|presque|incomplet/.test(s)) return "partiel";
  if (/faux|incorrect|errone|pas juste|pas bon|hors sujet/.test(s)) return "faux";
  if (/juste|correct|bon|vrai|exact/.test(s)) return "juste";
  return "faux";
}

export function sanitizeCorrectionOrale(raw: unknown): CorrectionOraleIA {
  const r = obj(raw);
  const verdict = verdictOf(r.verdict);
  return { verdict, retour: cleanText(r.retour, 1000), manque: verdict === "juste" ? [] : strings(r.manque, 5, 200) };
}

/** Nettoie la réponse de Claude selon le type demandé. */
export function sanitizeEtude(type: TypeEtude, raw: unknown): EtudeIA {
  switch (type) {
    case "fiche":
      return sanitizeFiche(raw);
    case "revision":
      return sanitizeRevision(raw);
    case "quiz":
      return sanitizeQuiz(raw);
    case "flashcards":
      return sanitizeFlashcards(raw);
    case "resume":
      return sanitizeResume(raw);
    case "frise":
      return sanitizeFrise(raw);
    case "exercices":
      return sanitizeExercices(raw);
    case "jeu":
      return sanitizeJeu(raw);
    case "oral":
      return sanitizeOral(raw);
  }
}

/** Vrai si le document contient assez de matière pour être affiché. */
export function isUsable(type: TypeEtude, doc: EtudeIA): boolean {
  switch (type) {
    case "fiche":
      return (doc as FicheIA).blocs.length > 0;
    case "revision":
      return (doc as RevisionIA).essentiel.length > 0 || (doc as RevisionIA).top10.length > 0;
    case "quiz":
      return (doc as QuizIA).questions.length > 0;
    case "flashcards":
      return (doc as FlashcardsIA).cartes.length > 0;
    case "resume":
      return (doc as ResumeIA).sections.length > 0 || Boolean((doc as ResumeIA).introduction);
    case "frise":
      return (doc as FriseIA).evenements.length > 0;
    case "exercices":
      return (doc as ExercicesIA).exercices.length > 0;
    case "jeu": {
      const j = doc as JeuIA;
      return j.paires.length >= 3 || j.trous.length > 0 || j.motsCroises.length >= 3;
    }
    case "oral":
      return (doc as OralIA).questions.length > 0;
  }
}
