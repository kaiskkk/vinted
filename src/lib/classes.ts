// Mode classe : un élève (ou un prof) crée une classe ; les autres la rejoignent avec son code.
// Tout ce qui est partagé dans la classe apparaît chez chaque membre, qui l'ouvre d'un tap (une copie chez lui).
//
// En ligne (Firestore, voir firestore.rules) :
//   classes/{code}                  { nom, proprietaire, ouverte, tousPartagent, createdAt }
//   classes/{code}/membres/{uid}    { nom, createdAt }
//   classes/{code}/documents/{id}   { kind, titre, data, auteur, auteurNom, createdAt }
// Sur l'appareil (et dans le compte, comme les documents) : ed-groupe:{code} → MaClasse.
import { accountsEnabled } from "./account";
import { DOC_TYPES, type DocType } from "./docs";
import type { ItemKind } from "./library";
import { buildPayload, importShared, type SharePayload } from "./share";

export const classesSupported = accountsEnabled;

/** Lettres et chiffres sans ambiguïté (pas de I, L, O, 0 ni 1). */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

export function randomCode(): string {
  const out: string[] = [];
  // Tirage sans biais : on rejette les octets au-delà du plus grand multiple de la taille de l'alphabet.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit && out.length < CODE_LENGTH) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return out.join("");
}

/** « ABCDEFGH » → « ABCD-EFGH », plus facile à lire et à dicter. */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Code tapé ou collé (avec tiret, espaces, minuscules, ou le lien d'invitation entier) ; null s'il n'est pas valide. */
export function parseCode(text: string): string | null {
  const fromLink = /#\/classe\/([A-Za-z0-9-]+)/.exec(text)?.[1];
  const raw = (fromLink ?? text).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== CODE_LENGTH) return null;
  return [...raw].every((c) => CODE_ALPHABET.includes(c)) ? raw : null;
}

export const inviteUrl = (code: string) => `${window.location.origin}/#/classe/${code}`;

// ---------- Mes classes, sur l'appareil ----------

export interface MaClasse {
  code: string;
  nom: string;
  createur: boolean;
  /** Peut ajouter des documents (créateur, ou classe ouverte au partage). */
  peutPartager: boolean;
  rejointLe: number;
  updatedAt: number;
  /** Date du document le plus récent déjà vu (pour signaler les nouveautés). */
  vu: number;
  /** Documents de la classe déjà ajoutés chez moi : id dans la classe → id chez moi. */
  imports: Record<string, { kind: ItemKind; id: string }>;
}

const PREFIX = "ed-groupe:";
const PRENOM_KEY = "ed-prenom";
const key = (code: string) => `${PREFIX}${code}`;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function parseMaClasse(raw: string | null, code: string): MaClasse | null {
  if (!raw) return null;
  try {
    const o = obj(JSON.parse(raw));
    const imports: MaClasse["imports"] = {};
    for (const [k, v] of Object.entries(obj(o.imports))) {
      const x = obj(v);
      if (typeof x.id === "string" && typeof x.kind === "string") imports[k] = { kind: x.kind as ItemKind, id: x.id };
    }
    return {
      code,
      nom: typeof o.nom === "string" && o.nom.trim() ? o.nom.slice(0, 80) : "Ma classe",
      createur: Boolean(o.createur),
      peutPartager: o.peutPartager !== false,
      rejointLe: num(o.rejointLe, Date.now()),
      updatedAt: num(o.updatedAt),
      vu: num(o.vu),
      imports,
    };
  } catch {
    return null;
  }
}

export function getMaClasse(code: string): MaClasse | null {
  try {
    return parseMaClasse(localStorage.getItem(key(code)), code);
  } catch {
    return null;
  }
}

export function listMesClasses(): MaClasse[] {
  const out: MaClasse[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const c = parseMaClasse(localStorage.getItem(k), k.slice(PREFIX.length));
      if (c) out.push(c);
    }
  } catch {
    // Stockage indisponible : aucune classe affichée.
  }
  return out.sort((a, b) => b.rejointLe - a.rejointLe);
}

export function saveMaClasse(c: MaClasse) {
  localStorage.setItem(key(c.code), JSON.stringify({ ...c, updatedAt: Date.now() }));
}

export function removeMaClasse(code: string) {
  localStorage.removeItem(key(code));
}

export function getPrenom(): string {
  try {
    return localStorage.getItem(PRENOM_KEY)?.slice(0, 40) ?? "";
  } catch {
    return "";
  }
}

export function setPrenom(prenom: string) {
  try {
    localStorage.setItem(PRENOM_KEY, prenom.trim().slice(0, 40));
  } catch {
    // Non mémorisé : il sera redemandé.
  }
}

// ---------- En ligne ----------

export interface ClasseInfo {
  code: string;
  nom: string;
  proprietaire: string;
  ouverte: boolean;
  tousPartagent: boolean;
}
export interface ClasseMembre {
  uid: string;
  nom: string;
  createdAt: number;
}
export interface ClasseDocument extends SharePayload {
  id: string;
  auteur: string;
  auteurNom: string;
  createdAt: number;
}

const cloud = () => import("./cloud");

/** Message clair pour une erreur Firestore du mode classe. */
export function classeErrorMessage(err: unknown, action: "rejoindre" | "ouvrir" | "partager" | "autre" = "autre"): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "permission-denied") {
    if (action === "rejoindre")
      return "Code inconnu, ou cette classe n'accepte plus de nouveaux membres. Vérifie le code avec la personne qui l'a créée.";
    if (action === "ouvrir") return "Tu ne fais pas (ou plus) partie de cette classe.";
    if (action === "partager") return "Dans cette classe, seul le créateur peut ajouter des documents.";
    return "Action refusée : seul le créateur de la classe peut faire cela.";
  }
  if (code === "unavailable" || !navigator.onLine) return "Pas de connexion internet : reconnecte-toi puis réessaie.";
  return err instanceof Error && err.message && !/firebase|firestore/i.test(err.message)
    ? err.message
    : "Ça n'a pas marché. Réessaie dans un instant.";
}

const KINDS: ItemKind[] = ["carte", "classeur", ...DOC_TYPES];
const isKind = (k: string): k is ItemKind => KINDS.includes(k as DocType);

export async function fetchClasse(code: string): Promise<ClasseInfo | null> {
  return (await cloud()).fetchClasseDoc(code);
}

export async function listMembres(code: string): Promise<ClasseMembre[]> {
  return (await cloud()).listClasseMembres(code);
}

export async function listDocuments(code: string): Promise<ClasseDocument[]> {
  const docs = await (await cloud()).latestClasseDocuments(code, 100);
  return docs.flatMap((d) => (isKind(d.kind) && d.data ? [{ ...d, kind: d.kind }] : []));
}

export async function deleteDocument(code: string, id: string) {
  await (await cloud()).deleteClasseDocument(code, id);
}

export async function removeMembre(code: string, uid: string) {
  await (await cloud()).removeClasseMembre(code, uid);
}

export async function updateClasse(code: string, patch: Partial<{ nom: string; ouverte: boolean; tousPartagent: boolean }>) {
  await (await cloud()).updateClasseDoc(code, patch);
  const mine = getMaClasse(code);
  if (mine) saveMaClasse({ ...mine, ...(patch.nom ? { nom: patch.nom } : {}) });
}

export async function leaveClasse(code: string) {
  const { removeClasseMembre, currentUid } = await cloud();
  const uid = currentUid();
  if (uid) await removeClasseMembre(code, uid);
  removeMaClasse(code);
}

export async function deleteClasse(code: string) {
  await (await cloud()).deleteClasseDeep(code);
  removeMaClasse(code);
}

export async function myUid(): Promise<string | null> {
  return (await cloud()).currentUid();
}

/** Crée une classe et renvoie son code (un nouveau code est tiré si, par malchance, il existe déjà). */
export async function createClasse(nom: string, prenom: string, tousPartagent: boolean): Promise<string> {
  const { createClasseDoc } = await cloud();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomCode();
    try {
      await createClasseDoc(code, { nom: nom.trim().slice(0, 80), tousPartagent }, prenom.trim().slice(0, 40));
      saveMaClasse({
        code,
        nom: nom.trim().slice(0, 80),
        createur: true,
        peutPartager: true,
        rejointLe: Date.now(),
        updatedAt: Date.now(),
        vu: 0,
        imports: {},
      });
      setPrenom(prenom);
      return code;
    } catch (err) {
      lastError = err;
      if ((err as { code?: string })?.code !== "permission-denied") break;
    }
  }
  throw lastError;
}

export async function joinClasse(code: string, prenom: string): Promise<ClasseInfo> {
  const { joinClasseDoc, fetchClasseDoc, currentUid } = await cloud();
  await joinClasseDoc(code, prenom.trim().slice(0, 40));
  const info = await fetchClasseDoc(code);
  if (!info) throw Object.assign(new Error("Cette classe n'existe plus."), { code: "not-found" });
  const uid = currentUid();
  const prev = getMaClasse(code);
  saveMaClasse({
    code,
    nom: info.nom,
    createur: info.proprietaire === uid,
    peutPartager: info.proprietaire === uid || info.tousPartagent,
    rejointLe: prev?.rejointLe ?? Date.now(),
    updatedAt: Date.now(),
    vu: prev?.vu ?? 0,
    imports: prev?.imports ?? {},
  });
  setPrenom(prenom);
  return info;
}

/** Envoie une copie d'un document, d'une carte ou d'un classeur dans la classe. */
export async function shareToClasse(code: string, kind: ItemKind, id: string) {
  const payload = buildPayload(kind, id);
  const { addClasseDocument } = await cloud();
  await addClasseDocument(code, payload, getPrenom() || "Un membre");
}

/** Ouvre un document de la classe : la copie déjà ajoutée si elle existe encore, sinon une nouvelle copie. */
export function importFromClasse(code: string, d: ClasseDocument, exists: (kind: ItemKind, id: string) => boolean): { kind: ItemKind; id: string } {
  const mine = getMaClasse(code);
  const already = mine?.imports[d.id];
  if (already && exists(already.kind, already.id)) return already;
  const copy = importShared(d);
  if (mine) saveMaClasse({ ...mine, imports: { ...mine.imports, [d.id]: copy } });
  return copy;
}

/** Nombre de documents ajoutés par les autres depuis la dernière visite, pour chaque classe (accueil). */
export async function countNouveautes(classes: MaClasse[]): Promise<Record<string, number>> {
  if (!classesSupported || !classes.length || !navigator.onLine) return {};
  const { latestClasseDocuments, currentUid } = await cloud();
  const uid = currentUid();
  const out: Record<string, number> = {};
  await Promise.all(
    classes.map(async (c) => {
      try {
        const docs = await latestClasseDocuments(c.code, 20);
        out[c.code] = docs.filter((d) => d.createdAt > c.vu && d.auteur !== uid).length;
      } catch {
        // Classe quittée ou hors connexion : rien à signaler.
      }
    }),
  );
  return out;
}
