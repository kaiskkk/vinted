// Partage par lien : une copie figée d'un document, d'une carte mentale ou d'un classeur entier,
// enregistrée dans Firestore (partages/{id}). Celui qui ouvre le lien l'ajoute à ses propres documents.
import { accountsEnabled } from "./account";
import {
  listDocs,
  loadClasseur,
  loadDoc,
  mapIdsOfClasseur,
  normalizeClasseur,
  normalizeDoc,
  saveClasseur,
  saveDoc,
  linkMap,
  type StudyDoc,
} from "./docs";
import type { ItemKind } from "./library";
import { newId } from "./mapModel";
import { hydrateMap, loadMap, saveMap } from "./storage";

/** Le partage passe par les comptes (Firebase) : sans eux, le bouton n'apparaît pas. */
export const shareSupported = accountsEnabled;

/** Limite d'un document Firestore (1 Mio), avec une marge. */
const MAX_CHARS = 900_000;

export interface SharePayload {
  kind: ItemKind;
  titre: string;
  data: string;
}

/** Identifiant impossible à deviner (20 caractères). */
export function randomShareId(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Copie à partager : sans le classeur d'origine ni la progression personnelle (scores, réponses, brouillon). */
export function cleanForShare(doc: StudyDoc): StudyDoc {
  const { classeurId: _omit, ...rest } = doc;
  void _omit;
  const d = rest as StudyDoc;
  switch (d.type) {
    case "quiz":
      return { ...d, tentatives: [] };
    case "flashcards":
      return { ...d, cartes: d.cartes.map((c) => ({ ...c, boite: 0, prochaine: 0, revues: 0, reussites: 0 })) };
    case "planning":
      return { ...d, jours: d.jours.map((j) => ({ ...j, taches: j.taches.map((t) => ({ ...t, fait: false })) })) };
    case "exercices":
      return { ...d, exercices: d.exercices.map((e) => ({ ...e, maReponse: "", statut: "a-faire" as const })) };
    case "copie":
      return {
        ...d,
        erreurs: d.erreurs.map((e) => ({ ...e, comprise: false })),
        exercices: d.exercices.map((e) => ({ ...e, maReponse: "", statut: "a-faire" as const })),
      };
    case "jeu":
      return { ...d, records: {} };
    case "redaction":
      // Le sujet et le plan seulement : le texte de l'élève reste à lui.
      return { ...d, brouillon: "", relectures: [] };
    default:
      return d;
  }
}

export function buildPayload(kind: ItemKind, id: string): SharePayload {
  let titre = "";
  let data: unknown;
  if (kind === "carte") {
    const map = loadMap(id);
    if (!map) throw new Error("Cette carte est introuvable.");
    titre = map.name;
    data = map;
  } else if (kind === "classeur") {
    const c = loadClasseur(id);
    if (!c) throw new Error("Ce classeur est introuvable.");
    titre = c.nom;
    data = {
      classeur: { ...c, chat: [] },
      documents: listDocs()
        .filter((d) => d.classeurId === id)
        .flatMap((d) => {
          const doc = loadDoc(d.id);
          return doc ? [cleanForShare(doc)] : [];
        }),
      cartes: mapIdsOfClasseur(id).flatMap((m) => {
        const map = loadMap(m);
        return map ? [map] : [];
      }),
    };
  } else {
    const doc = loadDoc(id);
    if (!doc) throw new Error("Ce document est introuvable.");
    titre = doc.titre;
    data = cleanForShare(doc);
  }
  const json = JSON.stringify(data);
  if (json.length > MAX_CHARS) throw new Error("C'est trop volumineux pour être partagé par lien : partage plutôt les documents un par un.");
  return { kind, titre, data: json };
}

export const shareUrl = (id: string) => `${window.location.origin}/#/partage/${id}`;

/** Publie une copie et renvoie le lien à envoyer. */
export async function createShareLink(kind: ItemKind, id: string): Promise<string> {
  if (!shareSupported) throw new Error("Le partage demande d'être connecté à un compte.");
  const payload = buildPayload(kind, id);
  const shareId = randomShareId();
  const { publishShare } = await import("./cloud");
  await publishShare(shareId, payload);
  return shareUrl(shareId);
}

export async function fetchShared(id: string): Promise<SharePayload | null> {
  const { fetchShare } = await import("./cloud");
  const shared = await fetchShare(id);
  return shared ? { kind: shared.kind as ItemKind, titre: shared.titre, data: shared.data } : null;
}

function importDoc(raw: unknown, classeurId?: string): StudyDoc | null {
  const doc = normalizeDoc(raw);
  if (!doc) return null;
  const now = Date.now();
  const copy = { ...doc, id: newId(), createdAt: now, updatedAt: now, ...(classeurId ? { classeurId } : {}) } as StudyDoc;
  if (!classeurId) delete (copy as { classeurId?: string }).classeurId;
  saveDoc(copy);
  return copy;
}

function importMap(raw: unknown, classeurId?: string): string | null {
  if (!raw || typeof raw !== "object") return null;
  const map = hydrateMap({ ...(raw as object), id: newId() });
  if (!map.nodes.length) return null;
  const now = Date.now();
  saveMap({ ...map, createdAt: now, updatedAt: now });
  if (classeurId) linkMap(map.id, classeurId);
  return map.id;
}

/** Ajoute la copie partagée aux documents de l'élève ; renvoie de quoi l'ouvrir. */
export function importShared(p: SharePayload): { kind: ItemKind; id: string } {
  const data = JSON.parse(p.data) as unknown;
  if (p.kind === "carte") {
    const id = importMap(data);
    if (!id) throw new Error("Cette carte partagée est vide ou abîmée.");
    return { kind: "carte", id };
  }
  if (p.kind === "classeur") {
    const bundle = (data && typeof data === "object" ? data : {}) as { classeur?: unknown; documents?: unknown[]; cartes?: unknown[] };
    const now = Date.now();
    const id = newId();
    const classeur = normalizeClasseur(bundle.classeur, id);
    saveClasseur({ ...classeur, id, chat: [], createdAt: now, updatedAt: now });
    for (const d of Array.isArray(bundle.documents) ? bundle.documents : []) importDoc(d, id);
    for (const m of Array.isArray(bundle.cartes) ? bundle.cartes : []) importMap(m, id);
    return { kind: "classeur", id };
  }
  const doc = importDoc(data);
  if (!doc) throw new Error("Ce document partagé est abîmé.");
  return { kind: doc.type, id: doc.id };
}
