// Génère un document (ou une carte mentale) avec Claude, l'enregistre et renvoie son id.
import type { Difficulte, Niveau, TypeEtude } from "../../shared/study";
import { generateEtude, generateMapFromCourse, type SourceEtude } from "./api";
import {
  ficheFromIA,
  flashcardsFromIA,
  friseFromIA,
  linkMap,
  quizFromIA,
  resumeFromIA,
  revisionFromIA,
  saveDoc,
  touchClasseur,
  type StudyDoc,
} from "./docs";
import { limitSource } from "./importSource";
import { recordActivity } from "./serie";

export interface GenerateOptions {
  nombre?: number;
  difficulte?: Difficulte;
  consigne?: string;
}

/** Cours tronqué à la taille acceptée par le serveur, sujet nettoyé. */
export function prepareSource(source: SourceEtude): SourceEtude {
  const cours = limitSource(source.cours?.trim() ?? "").texte;
  const sujet = source.sujet?.trim().slice(0, 300) ?? "";
  return { ...(cours ? { cours } : {}), ...(sujet ? { sujet } : {}) };
}

export async function generateDoc(
  type: TypeEtude,
  source: SourceEtude,
  niveau: Niveau,
  options: GenerateOptions,
  classeurId: string | undefined,
  signal?: AbortSignal,
): Promise<StudyDoc> {
  const src = prepareSource(source);
  let doc: StudyDoc;
  switch (type) {
    case "fiche":
      doc = ficheFromIA(await generateEtude("fiche", src, niveau, options, signal), classeurId);
      break;
    case "revision":
      doc = revisionFromIA(await generateEtude("revision", src, niveau, options, signal), classeurId);
      break;
    case "quiz":
      doc = quizFromIA(await generateEtude("quiz", src, niveau, options, signal), options.difficulte ?? "moyen", classeurId);
      break;
    case "flashcards":
      doc = flashcardsFromIA(await generateEtude("flashcards", src, niveau, options, signal), classeurId);
      break;
    case "resume":
      doc = resumeFromIA(await generateEtude("resume", src, niveau, options, signal), classeurId);
      break;
    case "frise":
      doc = friseFromIA(await generateEtude("frise", src, niveau, options, signal), classeurId);
      break;
  }
  if (signal?.aborted) throw new DOMException("Annulé", "AbortError");
  saveDoc(doc);
  touchClasseur(classeurId);
  recordActivity("generation");
  return doc;
}

/** Carte mentale du cours : même format que les cartes créées à la main. */
export async function generateCarte(
  titre: string,
  source: SourceEtude,
  niveau: Niveau,
  classeurId: string | undefined,
  signal?: AbortSignal,
): Promise<string> {
  const src = prepareSource(source);
  const prompt = src.cours ? `Carte mentale du cours « ${titre} »` : (src.sujet ?? titre);
  const ai = await generateMapFromCourse(prompt.slice(0, 2000), src.cours ?? "", niveau, signal);
  if (signal?.aborted) throw new DOMException("Annulé", "AbortError");
  // Chargés seulement ici : la disposition automatique est assez lourde.
  const [{ aiToFlow, DEFAULT_EDGE, newId }, { layoutTree }, { saveMap }] = await Promise.all([
    import("./mapModel"),
    import("./layout"),
    import("./storage"),
  ]);
  const { nodes, edges } = aiToFlow(ai, DEFAULT_EDGE);
  const positions = layoutTree(nodes, edges);
  const now = Date.now();
  const id = newId();
  saveMap({
    id,
    name: ai.titre || titre,
    createdAt: now,
    updatedAt: now,
    nodes: nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })),
    edges,
    edgeDefaults: { ...DEFAULT_EDGE },
  });
  if (classeurId) {
    linkMap(id, classeurId);
    touchClasseur(classeurId);
  }
  recordActivity("generation");
  return id;
}
