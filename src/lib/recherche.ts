// Recherche dans le contenu des documents (pas seulement leurs titres), insensible aux accents et à la casse.
import { docSegments } from "./docSpeech";
import { loadClasseur, loadDoc } from "./docs";
import { fold } from "./format";
import type { LibraryItem } from "./library";
import { speakable } from "./speech";
import { loadMap } from "./storage";

export interface ContentEntry {
  segments: string[];
  folded: string[];
}

export const itemKey = (item: Pick<LibraryItem, "kind" | "id">) => `${item.kind}-${item.id}`;

/** Les morceaux de texte d'un élément : blocs d'une fiche, questions d'un quiz, idées d'une carte, cours d'un classeur… */
export function contentOf(item: Pick<LibraryItem, "kind" | "id">): string[] {
  if (item.kind === "carte") return (loadMap(item.id)?.nodes ?? []).map((n) => n.data.label).filter((t) => t?.trim());
  if (item.kind === "classeur") {
    const c = loadClasseur(item.id);
    return c ? [c.sujet, ...c.cours.split(/\n+/)].filter((t) => t.trim()) : [];
  }
  const doc = loadDoc(item.id);
  return doc ? docSegments(doc) : [];
}

/** Index du contenu, construit une fois au début d'une recherche. */
export function buildIndex(items: Pick<LibraryItem, "kind" | "id">[]): Map<string, ContentEntry> {
  const index = new Map<string, ContentEntry>();
  for (const item of items) {
    const segments = contentOf(item).map((s) => speakable(s));
    index.set(itemKey(item), { segments, folded: segments.map(fold) });
  }
  return index;
}

/** Extrait autour du premier passage trouvé (« …la photosynthèse a lieu dans les chloroplastes… »), ou null. */
export function findSnippet(entry: ContentEntry | undefined, query: string, around = 45): string | null {
  const q = fold(query.trim());
  if (!entry || q.length < 2) return null;
  for (let i = 0; i < entry.folded.length; i++) {
    const at = entry.folded[i].indexOf(q);
    if (at < 0) continue;
    const seg = entry.segments[i];
    // Sans les accents, le texte garde presque toujours la même longueur : la position correspond.
    const pos = Math.round((at * seg.length) / Math.max(1, entry.folded[i].length));
    const start = Math.max(0, pos - around);
    const end = Math.min(seg.length, pos + q.length + around);
    return `${start > 0 ? "…" : ""}${seg.slice(start, end).trim()}${end < seg.length ? "…" : ""}`;
  }
  return null;
}
