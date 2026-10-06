import type { MapPreview, MapSummary, MindEdge, MindMap, MindNode } from "../types";
import { DEFAULT_EDGE, newId, normalizeEdge, normalizeEdgeData, normalizeNode, rootNode } from "./mapModel";
import { estimateSize } from "./nodeSize";

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

const PREVIEW_BOX = { w: 240, h: 140 };
const PREVIEW_MAX_NODES = 80;
const round = (v: number) => Math.round(v * 10) / 10;

/** Miniature légère d'une carte, pour la page d'accueil (rectangles colorés et traits). */
export function computePreview(nodes: MindNode[], edges: MindEdge[]): MapPreview | undefined {
  if (nodes.length === 0) return undefined;
  const boxes = nodes.slice(0, PREVIEW_MAX_NODES).map((n) => {
    const s = estimateSize(n.data);
    return { id: n.id, x: n.position.x, y: n.position.y, w: s.width, h: s.height, c: n.data.bgColor };
  });
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const width = Math.max(...boxes.map((b) => b.x + b.w)) - minX || 1;
  const height = Math.max(...boxes.map((b) => b.y + b.h)) - minY || 1;
  // Une carte d'un seul nœud ne doit pas remplir toute la miniature.
  const k = Math.min(PREVIEW_BOX.w / width, PREVIEW_BOX.h / height, 0.6);
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const cx = (b: (typeof boxes)[number]) => round((b.x - minX + b.w / 2) * k);
  const cy = (b: (typeof boxes)[number]) => round((b.y - minY + b.h / 2) * k);
  return {
    w: round(width * k),
    h: round(height * k),
    n: boxes.map((b) => [round((b.x - minX) * k), round((b.y - minY) * k), round(b.w * k), round(b.h * k), b.c]),
    e: edges.flatMap((e): MapPreview["e"] => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      return s && t ? [[cx(s), cy(s), cx(t), cy(t), t.c]] : [];
    }),
  };
}

function summaryOf(map: MindMap): MapSummary {
  return {
    id: map.id,
    name: map.name,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
    nodeCount: map.nodes.length,
    preview: computePreview(map.nodes, map.edges),
  };
}

export function listMaps(): MapSummary[] {
  const index = readJson<MapSummary[]>(INDEX_KEY) ?? [];
  // Migration douce : les cartes enregistrées avant l'ajout des miniatures en reçoivent une.
  let migrated = false;
  const complete = index.map((s) => {
    if (s.preview || s.nodeCount === 0) return s;
    const map = loadMap(s.id);
    if (!map) return s;
    migrated = true;
    return { ...s, preview: computePreview(map.nodes, map.edges) };
  });
  if (migrated) {
    try {
      writeJson(INDEX_KEY, complete);
    } catch {
      // Stockage plein : les miniatures seront recalculées la prochaine fois.
    }
  }
  return [...complete].sort((a, b) => b.updatedAt - a.updatedAt);
}

function upsertSummary(map: MindMap) {
  const index = (readJson<MapSummary[]>(INDEX_KEY) ?? []).filter((m) => m.id !== map.id);
  index.push(summaryOf(map));
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
