// Documents d'étude (fiches, révision, planning, quiz, flashcards, résumé) et classeurs.
// Même principe que les cartes : chaque élément a sa propre clé, un index léger sert aux listes.
// Les cartes mentales restent dans leur format d'origine (mm-*) ; leur classeur est noté à part.
import {
  BLOC_TYPES,
  cleanText,
  isNiveau,
  sanitizeQuestion,
  type BlocType,
  type Difficulte,
  type FicheIA,
  type FlashcardsIA,
  type Niveau,
  type QuizIA,
  type ResumeIA,
  type RevisionIA,
} from "../../shared/study";
import { normalizeHex } from "../../shared/aiMap";
import { newId } from "./mapModel";

export type DocType = "fiche" | "revision" | "planning" | "quiz" | "flashcards" | "resume";
export const DOC_TYPES: DocType[] = ["fiche", "revision", "planning", "quiz", "flashcards", "resume"];

interface DocBase {
  id: string;
  titre: string;
  classeurId?: string;
  createdAt: number;
  updatedAt: number;
}

export type FicheStyle = "classique" | "coloree" | "minimaliste" | "cahier";
export const FICHE_STYLES: FicheStyle[] = ["classique", "coloree", "minimaliste", "cahier"];

export interface FicheBloc {
  id: string;
  type: BlocType;
  titre: string;
  contenu: string;
  /** Couleur choisie à la main ; sinon celle du type. */
  couleur?: string;
}
export interface FicheDoc extends DocBase {
  type: "fiche";
  sousTitre: string;
  style: FicheStyle;
  blocs: FicheBloc[];
}

export interface RevisionDoc extends DocBase {
  type: "revision";
  essentiel: { id: string; titre: string; points: string[] }[];
  top10: { id: string; texte: string; detail: string }[];
  pieges: string[];
}

export type TacheGenre = "apprendre" | "reviser" | "bilan" | "examen";
export interface PlanningTache {
  id: string;
  texte: string;
  genre: TacheGenre;
  chapitre?: string;
  fait: boolean;
}
export interface PlanningJour {
  /** Date locale AAAA-MM-JJ. */
  date: string;
  taches: PlanningTache[];
}
export interface PlanningDoc extends DocBase {
  type: "planning";
  dateExamen: string;
  debut: string;
  chapitres: string[];
  jours: PlanningJour[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  choix: string[];
  bonne: number;
  explication: string;
}
export interface QuizTentative {
  date: number;
  score: number;
  total: number;
}
export interface QuizDoc extends DocBase {
  type: "quiz";
  difficulte: Difficulte;
  questions: QuizQuestion[];
  tentatives: QuizTentative[];
}

export interface Flashcard {
  id: string;
  recto: string;
  verso: string;
  /** Boîte de Leitner : 0 = à apprendre, 5 = maîtrisée. */
  boite: number;
  /** Date (ms) à partir de laquelle la carte est à revoir. */
  prochaine: number;
  revues: number;
  reussites: number;
}
export interface FlashcardsDoc extends DocBase {
  type: "flashcards";
  cartes: Flashcard[];
}

export interface ResumeDoc extends DocBase {
  type: "resume";
  introduction: string;
  sections: { id: string; titre: string; texte: string }[];
  conclusion: string;
}

export type StudyDoc = FicheDoc | RevisionDoc | PlanningDoc | QuizDoc | FlashcardsDoc | ResumeDoc;
export type DocOf<T extends DocType> = Extract<StudyDoc, { type: T }>;

export interface DocSummary {
  id: string;
  type: DocType;
  titre: string;
  classeurId?: string;
  createdAt: number;
  updatedAt: number;
  /** Petite info affichée dans les listes : « 12 questions », « 30 cartes »… */
  info: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  texte: string;
  date: number;
  /** Réponse en erreur : affichée, mais jamais renvoyée à Claude. */
  erreur?: boolean;
}

export interface Classeur {
  id: string;
  nom: string;
  createdAt: number;
  updatedAt: number;
  /** Texte du cours (collé ou extrait des fichiers importés). */
  cours: string;
  /** Sujet libre, quand il n'y a pas de cours. */
  sujet: string;
  fichiers: string[];
  chat: ChatMessage[];
}
export interface ClasseurSummary {
  id: string;
  nom: string;
  createdAt: number;
  updatedAt: number;
}

const DOCS_INDEX = "ed-docs";
const docKey = (id: string) => `ed-doc:${id}`;
const CLASSEURS_INDEX = "ed-classeurs";
const classeurKey = (id: string) => `ed-classeur:${id}`;
const MAP_LINKS = "ed-liens-cartes";
const NIVEAU_KEY = "ed-niveau";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new Error("Espace de stockage du navigateur plein : exporte une sauvegarde puis supprime d'anciens documents.");
    }
    throw err;
  }
}

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const idOf = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 100) : newId());
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ---------- Création à partir des réponses de Claude ----------

const fresh = (titre: string, classeurId?: string) => {
  const now = Date.now();
  return { id: newId(), titre, createdAt: now, updatedAt: now, ...(classeurId ? { classeurId } : {}) };
};

export function ficheFromIA(ia: FicheIA, classeurId?: string, style: FicheStyle = "classique"): FicheDoc {
  return {
    ...fresh(ia.titre, classeurId),
    type: "fiche",
    sousTitre: ia.sousTitre,
    style,
    blocs: ia.blocs.map((b) => ({ id: newId(), ...b })),
  };
}

export function blankFiche(titre = "Nouvelle fiche"): FicheDoc {
  return {
    ...fresh(titre),
    type: "fiche",
    sousTitre: "",
    style: "classique",
    blocs: [
      { id: newId(), type: "notion", titre: "Notion clé", contenu: "" },
      { id: newId(), type: "definition", titre: "Mot à définir", contenu: "" },
      { id: newId(), type: "retenir", titre: "À retenir", contenu: "- " },
    ],
  };
}

export function revisionFromIA(ia: RevisionIA, classeurId?: string): RevisionDoc {
  return {
    ...fresh(ia.titre, classeurId),
    type: "revision",
    essentiel: ia.essentiel.map((s) => ({ id: newId(), ...s })),
    top10: ia.top10.map((t) => ({ id: newId(), ...t })),
    pieges: ia.pieges,
  };
}

/** Mélange de Fisher-Yates (les réponses de Claude ne sont pas toujours bien réparties). */
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffleChoices(q: QuizQuestion, random = Math.random): QuizQuestion {
  const order = shuffle(
    q.choix.map((_, i) => i),
    random,
  );
  return { ...q, choix: order.map((i) => q.choix[i]), bonne: order.indexOf(q.bonne) };
}

export function quizFromIA(ia: QuizIA, difficulte: Difficulte, classeurId?: string): QuizDoc {
  return {
    ...fresh(ia.titre, classeurId),
    type: "quiz",
    difficulte,
    questions: ia.questions.map((q) =>
      shuffleChoices({ id: newId(), question: q.question, choix: q.choix, bonne: q.bonneReponse, explication: q.explication }),
    ),
    tentatives: [],
  };
}

export const newCard = (recto: string, verso: string): Flashcard => ({
  id: newId(),
  recto,
  verso,
  boite: 0,
  prochaine: 0,
  revues: 0,
  reussites: 0,
});

export function flashcardsFromIA(ia: FlashcardsIA, classeurId?: string): FlashcardsDoc {
  return { ...fresh(ia.titre, classeurId), type: "flashcards", cartes: ia.cartes.map((c) => newCard(c.recto, c.verso)) };
}

export function blankDeck(titre = "Nouveau paquet"): FlashcardsDoc {
  return { ...fresh(titre), type: "flashcards", cartes: [] };
}

export function resumeFromIA(ia: ResumeIA, classeurId?: string): ResumeDoc {
  return {
    ...fresh(ia.titre, classeurId),
    type: "resume",
    introduction: ia.introduction,
    sections: ia.sections.map((s) => ({ id: newId(), ...s })),
    conclusion: ia.conclusion,
  };
}

export function newPlanning(
  titre: string,
  data: Pick<PlanningDoc, "dateExamen" | "debut" | "chapitres" | "jours">,
  classeurId?: string,
): PlanningDoc {
  return { ...fresh(titre, classeurId), type: "planning", ...data };
}

// ---------- Lecture robuste (données anciennes, importées ou modifiées à la main) ----------

export function normalizeDoc(raw: unknown): StudyDoc | null {
  const r = obj(raw);
  const type = r.type as DocType;
  if (!DOC_TYPES.includes(type)) return null;
  const now = Date.now();
  const base: DocBase = {
    id: idOf(r.id),
    titre: cleanText(r.titre, 140) || "Sans titre",
    createdAt: num(r.createdAt, now),
    updatedAt: num(r.updatedAt, now),
    ...(typeof r.classeurId === "string" && r.classeurId ? { classeurId: r.classeurId } : {}),
  };
  switch (type) {
    case "fiche":
      return {
        ...base,
        type,
        sousTitre: cleanText(r.sousTitre, 200),
        style: FICHE_STYLES.includes(r.style as FicheStyle) ? (r.style as FicheStyle) : "classique",
        blocs: list(r.blocs).map((b) => {
          const o = obj(b);
          const couleur = normalizeHex(o.couleur);
          return {
            id: idOf(o.id),
            type: BLOC_TYPES.includes(o.type as BlocType) ? (o.type as BlocType) : "texte",
            titre: cleanText(o.titre, 200),
            contenu: typeof o.contenu === "string" ? o.contenu.slice(0, 5000) : "",
            ...(couleur ? { couleur } : {}),
          };
        }),
      };
    case "revision":
      return {
        ...base,
        type,
        essentiel: list(r.essentiel).map((s) => {
          const o = obj(s);
          return {
            id: idOf(o.id),
            titre: cleanText(o.titre, 200),
            points: list(o.points)
              .map((p) => cleanText(p, 500))
              .filter(Boolean),
          };
        }),
        top10: list(r.top10).map((t) => {
          const o = obj(t);
          return { id: idOf(o.id), texte: cleanText(o.texte, 500), detail: cleanText(o.detail, 500) };
        }),
        pieges: list(r.pieges)
          .map((p) => cleanText(p, 500))
          .filter(Boolean),
      };
    case "planning":
      return {
        ...base,
        type,
        dateExamen: isDate(r.dateExamen) ? r.dateExamen : "",
        debut: isDate(r.debut) ? r.debut : "",
        chapitres: list(r.chapitres)
          .map((c) => cleanText(c, 200))
          .filter(Boolean),
        jours: list(r.jours)
          .map((j) => {
            const o = obj(j);
            return {
              date: isDate(o.date) ? o.date : "",
              taches: list(o.taches).map((t) => {
                const x = obj(t);
                const genres: TacheGenre[] = ["apprendre", "reviser", "bilan", "examen"];
                return {
                  id: idOf(x.id),
                  texte: cleanText(x.texte, 300),
                  genre: genres.includes(x.genre as TacheGenre) ? (x.genre as TacheGenre) : "reviser",
                  ...(typeof x.chapitre === "string" ? { chapitre: x.chapitre.slice(0, 200) } : {}),
                  fait: Boolean(x.fait),
                };
              }),
            };
          })
          .filter((j) => j.date),
      };
    case "quiz":
      return {
        ...base,
        type,
        difficulte: (["facile", "moyen", "difficile"] as const).includes(r.difficulte as Difficulte) ? (r.difficulte as Difficulte) : "moyen",
        questions: list(r.questions).flatMap((q) => {
          const o = obj(q);
          const clean = sanitizeQuestion({ ...o, bonneReponse: o.bonne });
          return clean
            ? [{ id: idOf(o.id), question: clean.question, choix: clean.choix, bonne: clean.bonneReponse, explication: clean.explication }]
            : [];
        }),
        tentatives: list(r.tentatives).flatMap((t) => {
          const o = obj(t);
          const total = num(o.total, 0);
          return total > 0 ? [{ date: num(o.date, now), score: Math.max(0, Math.min(total, num(o.score, 0))), total }] : [];
        }),
      };
    case "flashcards":
      return {
        ...base,
        type,
        cartes: list(r.cartes).flatMap((c) => {
          const o = obj(c);
          const recto = typeof o.recto === "string" ? o.recto.slice(0, 1000) : "";
          const verso = typeof o.verso === "string" ? o.verso.slice(0, 3000) : "";
          if (!recto.trim() && !verso.trim()) return [];
          return [
            {
              id: idOf(o.id),
              recto,
              verso,
              boite: Math.max(0, Math.min(5, Math.trunc(num(o.boite, 0)))),
              prochaine: num(o.prochaine, 0),
              revues: Math.max(0, num(o.revues, 0)),
              reussites: Math.max(0, num(o.reussites, 0)),
            },
          ];
        }),
      };
    case "resume":
      return {
        ...base,
        type,
        introduction: cleanText(r.introduction, 5000),
        sections: list(r.sections).map((s) => {
          const o = obj(s);
          return { id: idOf(o.id), titre: cleanText(o.titre, 200), texte: cleanText(o.texte, 8000) };
        }),
        conclusion: cleanText(r.conclusion, 5000),
      };
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export function docInfo(doc: StudyDoc): string {
  switch (doc.type) {
    case "fiche":
      return plural(doc.blocs.length, "bloc");
    case "revision":
      return `${plural(doc.essentiel.length, "rubrique")} · top ${doc.top10.length}`;
    case "planning": {
      const all = doc.jours.flatMap((j) => j.taches).filter((t) => t.genre !== "examen");
      return `${all.filter((t) => t.fait).length}/${all.length} séances faites`;
    }
    case "quiz":
      return plural(doc.questions.length, "question");
    case "flashcards":
      return plural(doc.cartes.length, "carte");
    case "resume":
      return plural(doc.sections.length, "partie");
  }
}

const summaryOf = (doc: StudyDoc): DocSummary => ({
  id: doc.id,
  type: doc.type,
  titre: doc.titre,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  info: docInfo(doc),
  ...(doc.classeurId ? { classeurId: doc.classeurId } : {}),
});

// ---------- Documents ----------

export function listDocs(): DocSummary[] {
  const index = readJson<DocSummary[]>(DOCS_INDEX);
  return (Array.isArray(index) ? index : [])
    .filter((d) => d && typeof d.id === "string" && DOC_TYPES.includes(d.type))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadDoc(id: string): StudyDoc | null {
  const raw = readJson<unknown>(docKey(id));
  if (!raw) return null;
  const doc = normalizeDoc({ ...obj(raw), id });
  return doc;
}

export function saveDoc(doc: StudyDoc) {
  writeJson(docKey(doc.id), doc);
  const index = (readJson<DocSummary[]>(DOCS_INDEX) ?? []).filter((d) => d.id !== doc.id);
  index.push(summaryOf(doc));
  writeJson(DOCS_INDEX, index);
}

export function deleteDoc(id: string) {
  localStorage.removeItem(docKey(id));
  writeJson(
    DOCS_INDEX,
    (readJson<DocSummary[]>(DOCS_INDEX) ?? []).filter((d) => d.id !== id),
  );
}

export function renameDoc(id: string, titre: string) {
  const doc = loadDoc(id);
  if (!doc) return;
  saveDoc({ ...doc, titre, updatedAt: Date.now() });
}

// ---------- Classeurs ----------

export function normalizeClasseur(raw: unknown, id: string): Classeur {
  const r = obj(raw);
  const now = Date.now();
  return {
    id,
    nom: cleanText(r.nom, 140) || "Classeur sans nom",
    createdAt: num(r.createdAt, now),
    updatedAt: num(r.updatedAt, now),
    cours: typeof r.cours === "string" ? r.cours : "",
    sujet: cleanText(r.sujet, 300),
    fichiers: list(r.fichiers)
      .filter((f): f is string => typeof f === "string")
      .slice(0, 50),
    chat: list(r.chat).flatMap((m) => {
      const o = obj(m);
      if ((o.role !== "user" && o.role !== "assistant") || typeof o.texte !== "string") return [];
      return [{ id: idOf(o.id), role: o.role, texte: o.texte, date: num(o.date, now), ...(o.erreur ? { erreur: true } : {}) }];
    }),
  };
}

export function listClasseurs(): ClasseurSummary[] {
  const index = readJson<ClasseurSummary[]>(CLASSEURS_INDEX);
  return (Array.isArray(index) ? index : []).filter((c) => c && typeof c.id === "string").sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadClasseur(id: string): Classeur | null {
  const raw = readJson<unknown>(classeurKey(id));
  return raw ? normalizeClasseur(raw, id) : null;
}

export function saveClasseur(c: Classeur) {
  writeJson(classeurKey(c.id), c);
  const index = (readJson<ClasseurSummary[]>(CLASSEURS_INDEX) ?? []).filter((x) => x.id !== c.id);
  index.push({ id: c.id, nom: c.nom, createdAt: c.createdAt, updatedAt: c.updatedAt });
  writeJson(CLASSEURS_INDEX, index);
}

export function createClasseur(data: Partial<Pick<Classeur, "nom" | "cours" | "sujet" | "fichiers">>): Classeur {
  const now = Date.now();
  const c: Classeur = {
    id: newId(),
    nom: data.nom?.trim() || "Nouveau classeur",
    createdAt: now,
    updatedAt: now,
    cours: data.cours ?? "",
    sujet: data.sujet ?? "",
    fichiers: data.fichiers ?? [],
    chat: [],
  };
  saveClasseur(c);
  return c;
}

/** Le classeur a été modifié (nouveau document, question…) : il remonte dans les listes. */
export function touchClasseur(id: string | undefined) {
  if (!id) return;
  const c = loadClasseur(id);
  if (c) saveClasseur({ ...c, updatedAt: Date.now() });
}

export function docsOfClasseur(id: string): DocSummary[] {
  return listDocs().filter((d) => d.classeurId === id);
}

// ---------- Cartes mentales rangées dans un classeur ----------

function readLinks(): Record<string, string> {
  const links = readJson<Record<string, string>>(MAP_LINKS);
  return links && typeof links === "object" && !Array.isArray(links) ? links : {};
}

export function linkMap(mapId: string, classeurId: string) {
  writeJson(MAP_LINKS, { ...readLinks(), [mapId]: classeurId });
}

export function unlinkMap(mapId: string) {
  const links = readLinks();
  if (!(mapId in links)) return;
  delete links[mapId];
  writeJson(MAP_LINKS, links);
}

export const classeurOfMap = (mapId: string): string | undefined => readLinks()[mapId];

export function mapIdsOfClasseur(id: string): string[] {
  return Object.entries(readLinks())
    .filter(([, c]) => c === id)
    .map(([m]) => m);
}

// ---------- Niveau scolaire ----------

export function getNiveau(): Niveau {
  try {
    const v = localStorage.getItem(NIVEAU_KEY);
    return isNiveau(v) ? v : "lycee";
  } catch {
    return "lycee";
  }
}

export function setNiveau(n: Niveau) {
  try {
    localStorage.setItem(NIVEAU_KEY, n);
  } catch {
    // Non mémorisé : sans gravité.
  }
}
