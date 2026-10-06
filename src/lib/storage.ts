import type { MapSummary, MindMap } from "../types";
import { DEFAULT_EDGE, newId, normalizeEdge, normalizeEdgeData, normalizeNode, rootNode } from "./mapModel";

// Chaque carte est stockée sous sa propre clé ; un index léger sert à la page d'accueil.
const INDEX_KEY = "mm-index";
const mapKey = (id: string) => `mm-map:${id}`;

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
      throw new Error("Espace de stockage du navigateur plein : exporte puis supprime d'anciennes cartes.");
    }
    throw err;
  }
}

export function listMaps(): MapSummary[] {
  const index = readJson<MapSummary[]>(INDEX_KEY) ?? [];
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt);
}

function upsertSummary(map: MindMap) {
  const index = (readJson<MapSummary[]>(INDEX_KEY) ?? []).filter((m) => m.id !== map.id);
  index.push({
    id: map.id,
    name: map.name,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    nodeCount: map.nodes.length,
  });
  writeJson(INDEX_KEY, index);
}

/** Lit une carte en réparant ce qui peut l'être (données anciennes ou modifiées à la main). */
export function loadMap(id: string): MindMap | null {
  const raw = readJson<Partial<MindMap>>(mapKey(id));
  if (!raw) return null;
  return hydrateMap({ ...raw, id });
}

export function hydrateMap(raw: Partial<MindMap>): MindMap {
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).map(normalizeNode).filter((n) => n !== null);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (Array.isArray(raw.edges) ? raw.edges : []).map((e) => normalizeEdge(e, ids)).filter((e) => e !== null);
  const now = Date.now();
  return {
    id: raw.id ?? newId(),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Carte sans titre",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
    nodes,
    edges,
    edgeDefaults: raw.edgeDefaults ? normalizeEdgeData(raw.edgeDefaults) : { ...DEFAULT_EDGE },
    viewport: raw.viewport,
  };
}

export function saveMap(map: MindMap) {
  writeJson(mapKey(map.id), map);
  upsertSummary(map);
}

export function createMap(name: string): MindMap {
  const now = Date.now();
  const map: MindMap = {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    nodes: [rootNode(name)],
    edges: [],
    edgeDefaults: { ...DEFAULT_EDGE },
  };
  saveMap(map);
  return map;
}

/** Renomme la carte ; le nœud central suit s'il portait encore l'ancien nom. */
export function renameMap(id: string, name: string) {
  const map = loadMap(id);
  if (!map) return;
  const old = map.name;
  map.name = name;
  map.nodes = map.nodes.map((n) => (n.data.isRoot && n.data.label === old ? { ...n, data: { ...n.data, label: name } } : n));
  map.updatedAt = Date.now();
  saveMap(map);
}

export function deleteMap(id: string) {
  localStorage.removeItem(mapKey(id));
  writeJson(
    INDEX_KEY,
    (readJson<MapSummary[]>(INDEX_KEY) ?? []).filter((m) => m.id !== id),
  );
}
