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
export type TypeEtude = "fiche" | "revision" | "quiz" | "flashcards" | "resume";
export const TYPES_ETUDE: TypeEtude[] = ["fiche", "revision", "quiz", "flashcards", "resume"];

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

export type EtudeIA = FicheIA | RevisionIA | QuizIA | FlashcardsIA | ResumeIA;

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
  }
}
