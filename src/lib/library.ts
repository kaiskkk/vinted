// Vue d'ensemble de tout ce que l'élève a créé (cartes, documents, classeurs),
// suppression d'un classeur complet et sauvegarde / restauration de toutes les données.
import { DEFAULT_EDGE } from "./mapModel";
import {
  DOC_TYPES,
  listClasseurs,
  listDocs,
  loadClasseur,
  loadDoc,
  mapIdsOfClasseur,
  normalizeClasseur,
  normalizeDoc,
  saveClasseur,
  saveDoc,
  type DocType,
} from "./docs";
import { mergeSerie, parseSerie, readSerie, type SerieData } from "./serie";
import { hydrateMap, listMaps, loadMap, saveMap } from "./storage";

export type ItemKind = "carte" | DocType | "classeur";

export interface LibraryItem {
  kind: ItemKind;
  id: string;
  titre: string;
  updatedAt: number;
  info: string;
  classeurId?: string;
}

/** Tout ce qui a été créé, du plus récent au plus ancien. */
export function listLibrary(): LibraryItem[] {
  const links = readLinks();
  const items: LibraryItem[] = [
    ...listMaps().map((m) => ({
      kind: "carte" as const,
      id: m.id,
      titre: m.name,
      updatedAt: m.updatedAt,
      info: `${m.nodeCount} idée${m.nodeCount > 1 ? "s" : ""}`,
      ...(links[m.id] ? { classeurId: links[m.id] } : {}),
    })),
    ...listDocs().map((d) => ({ kind: d.type, id: d.id, titre: d.titre, updatedAt: d.updatedAt, info: d.info, classeurId: d.classeurId })),
    ...listClasseurs().map((c) => ({ kind: "classeur" as const, id: c.id, titre: c.nom, updatedAt: c.updatedAt, info: "Classeur" })),
  ];
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

function readLinks(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem("ed-liens-cartes") ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// ---------- Instantanés (pour « Annuler » après une suppression) ----------

export type Snapshot = Record<string, string | null>;

export function snapshot(keys: string[]): Snapshot {
  const snap: Snapshot = {};
  for (const k of keys) {
    try {
      snap[k] = localStorage.getItem(k);
    } catch {
      snap[k] = null;
    }
  }
  return snap;
}

export function restore(snap: Snapshot) {
  for (const [k, v] of Object.entries(snap)) {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  }
}

/** Supprime un classeur avec ses documents et ses cartes ; renvoie de quoi tout restaurer. */
export function deleteClasseurDeep(id: string): Snapshot {
  const docIds = listDocs()
    .filter((d) => d.classeurId === id)
    .map((d) => d.id);
  const mapIds = mapIdsOfClasseur(id);
  const snap = snapshot([
    "ed-classeurs",
    `ed-classeur:${id}`,
    "ed-docs",
    ...docIds.map((d) => `ed-doc:${d}`),
    "mm-index",
    ...mapIds.map((m) => `mm-map:${m}`),
    "ed-liens-cartes",
  ]);

  localStorage.removeItem(`ed-classeur:${id}`);
  localStorage.setItem("ed-classeurs", JSON.stringify(listClasseurs().filter((c) => c.id !== id)));
  for (const d of docIds) localStorage.removeItem(`ed-doc:${d}`);
  localStorage.setItem("ed-docs", JSON.stringify(listDocs().filter((d) => !docIds.includes(d.id))));
  for (const m of mapIds) localStorage.removeItem(`mm-map:${m}`);
  localStorage.setItem("mm-index", JSON.stringify(listMaps().filter((m) => !mapIds.includes(m.id))));
  const links = readLinks();
  for (const m of mapIds) delete links[m];
  localStorage.setItem("ed-liens-cartes", JSON.stringify(links));
  return snap;
}

// ---------- Sauvegarde complète ----------

export const BACKUP_FORMAT = "ecoleduc-sauvegarde";

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: 1;
  date: string;
  cartes: unknown[];
  documents: unknown[];
  classeurs: unknown[];
  liensCartes: Record<string, string>;
  /** Jours de révision (série 🔥) ; absent des sauvegardes plus anciennes. */
  serie?: SerieData;
}

export function exportAll(): Backup {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    date: new Date().toISOString(),
    cartes: listMaps().flatMap((m) => {
      const map = loadMap(m.id);
      return map ? [map] : [];
    }),
    documents: listDocs().flatMap((d) => {
      const doc = loadDoc(d.id);
      return doc ? [doc] : [];
    }),
    classeurs: listClasseurs().flatMap((c) => {
      const cl = loadClasseur(c.id);
      return cl ? [cl] : [];
    }),
    liensCartes: readLinks(),
    serie: readSerie(),
  };
}

export async function downloadBackup() {
  const { download } = await import("./exporters");
  const blob = new Blob([JSON.stringify(exportAll(), null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const day = new Date().toISOString().slice(0, 10);
  download(url, `ecoleduc-sauvegarde-${day}.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportReport {
  cartes: number;
  documents: number;
  classeurs: number;
}

const newer = (incoming: { updatedAt: number }, existing: { updatedAt: number } | null) => !existing || incoming.updatedAt >= existing.updatedAt;

/**
 * Restaure une sauvegarde en la fusionnant avec les données actuelles : rien n'est supprimé,
 * et pour un même élément, la version la plus récente est gardée.
 */
export function importAll(raw: unknown): ImportReport {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<Backup>;
  if (data.format !== BACKUP_FORMAT) throw new Error("Ce fichier n'est pas une sauvegarde ecoleduc.");
  const report: ImportReport = { cartes: 0, documents: 0, classeurs: 0 };

  for (const m of Array.isArray(data.cartes) ? data.cartes : []) {
    if (!m || typeof m !== "object" || typeof (m as { id?: unknown }).id !== "string") continue;
    const map = hydrateMap(m as Parameters<typeof hydrateMap>[0]);
    if (map.nodes.length === 0) continue;
    if (newer(map, loadMap(map.id))) {
      saveMap({ ...map, edgeDefaults: map.edgeDefaults ?? DEFAULT_EDGE });
      report.cartes++;
    }
  }
  for (const d of Array.isArray(data.documents) ? data.documents : []) {
    if (!d || typeof (d as { id?: unknown }).id !== "string") continue;
    const doc = normalizeDoc(d);
    if (!doc || !DOC_TYPES.includes(doc.type)) continue;
    if (newer(doc, loadDoc(doc.id))) {
      saveDoc(doc);
      report.documents++;
    }
  }
  for (const c of Array.isArray(data.classeurs) ? data.classeurs : []) {
    const id = (c as { id?: unknown })?.id;
    if (typeof id !== "string" || !id) continue;
    const cl = normalizeClasseur(c, id);
    if (newer(cl, loadClasseur(id))) {
      saveClasseur(cl);
      report.classeurs++;
    }
  }
  if (data.liensCartes && typeof data.liensCartes === "object") {
    const links = { ...readLinks() };
    for (const [m, c] of Object.entries(data.liensCartes)) if (typeof c === "string") links[m] = c;
    localStorage.setItem("ed-liens-cartes", JSON.stringify(links));
  }
  if (data.serie && typeof data.serie === "object") {
    const merged = mergeSerie(readSerie(), parseSerie(JSON.stringify(data.serie)));
    localStorage.setItem("ed-serie", JSON.stringify(merged));
  }
  return report;
}
