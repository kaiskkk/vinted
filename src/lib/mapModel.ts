import { BRANCH_COLORS, ROOT_COLOR, normalizeHex, type AiMap } from "../../shared/aiMap";
import type { EdgePath, MindEdge, MindEdgeData, MindNode, MindNodeData, Shape } from "../types";
import { contrastText } from "./colors";

export const SHAPES: Shape[] = ["circle", "rectangle", "rounded", "diamond", "cloud", "postit"];
const EDGE_PATHS: EdgePath[] = ["straight", "bezier", "step"];

export const DEFAULT_EDGE: MindEdgeData = { path: "bezier", dashed: false, arrow: false };

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function defaultNodeData(overrides: Partial<MindNodeData> = {}): MindNodeData {
  const bgColor = overrides.bgColor ?? BRANCH_COLORS[0];
  return {
    label: "Nouvelle idée",
    emoji: "",
    shape: "rounded",
    bgColor,
    textColor: contrastText(bgColor),
    fontSize: 15,
    bold: false,
    italic: false,
    ...overrides,
  };
}

export function rootNode(label: string): MindNode {
  return {
    id: newId(),
    type: "mind",
    position: { x: 0, y: 0 },
    data: defaultNodeData({
      label,
      bgColor: ROOT_COLOR,
      textColor: "#ffffff",
      fontSize: 22,
      bold: true,
      isRoot: true,
    }),
  };
}

export function makeEdge(source: string, target: string, data: MindEdgeData): MindEdge {
  return { id: `e-${newId()}`, source, target, type: "floating", data: { ...data } };
}

/** Rend un nœud (stocké ou importé) sûr à afficher, en complétant les champs manquants. */
export function normalizeNode(raw: unknown): MindNode | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Partial<MindNode> & { data?: Partial<MindNodeData> };
  if (typeof n.id !== "string" || !n.id) return null;
  const d: Partial<MindNodeData> = n.data ?? {};
  const bgColor = normalizeHex(d.bgColor) ?? BRANCH_COLORS[0];
  const data: MindNodeData = {
    label: typeof d.label === "string" ? d.label : "",
    emoji: typeof d.emoji === "string" ? d.emoji : "",
    shape: SHAPES.includes(d.shape as Shape) ? (d.shape as Shape) : "rounded",
    bgColor,
    textColor: normalizeHex(d.textColor) ?? contrastText(bgColor),
    fontSize: typeof d.fontSize === "number" && d.fontSize >= 8 && d.fontSize <= 72 ? d.fontSize : 15,
    bold: Boolean(d.bold),
    italic: Boolean(d.italic),
  };
  if (d.isRoot) data.isRoot = true;
  const x = Number(n.position?.x);
  const y = Number(n.position?.y);
  return {
    id: n.id,
    type: "mind",
    position: { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 },
    data,
  };
}

export function normalizeEdgeData(raw: unknown): MindEdgeData {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<MindEdgeData>;
  return {
    path: EDGE_PATHS.includes(d.path as EdgePath) ? (d.path as EdgePath) : DEFAULT_EDGE.path,
    dashed: Boolean(d.dashed),
    arrow: Boolean(d.arrow),
  };
}

export function normalizeEdge(raw: unknown, nodeIds: Set<string>): MindEdge | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Partial<MindEdge>;
  if (typeof e.source !== "string" || typeof e.target !== "string") return null;
  if (!nodeIds.has(e.source) || !nodeIds.has(e.target) || e.source === e.target) return null;
  return {
    id: typeof e.id === "string" && e.id ? e.id : `e-${newId()}`,
    source: e.source,
    target: e.target,
    type: "floating",
    data: normalizeEdgeData(e.data),
  };
}

/** Version « propre » d'un nœud pour la sauvegarde et l'historique (sans état d'interface). */
export function persistNode(n: MindNode): MindNode {
  const { loading: _loading, ...data } = n.data;
  return { id: n.id, type: "mind", position: { x: n.position.x, y: n.position.y }, data };
}

export function persistEdge(e: MindEdge): MindEdge {
  return { id: e.id, source: e.source, target: e.target, type: "floating", data: normalizeEdgeData(e.data) };
}

export function findRootId(nodes: MindNode[], edges: MindEdge[]): string | undefined {
  const flagged = nodes.find((n) => n.data.isRoot);
  if (flagged) return flagged.id;
  const targets = new Set(edges.map((e) => e.target));
  return (nodes.find((n) => !targets.has(n.id)) ?? nodes[0])?.id;
}

/**
 * Arbre couvrant depuis la racine (parcours en largeur, liens pris dans les deux sens).
 * Les liens ajoutés à la main entre branches ne cassent donc pas la structure.
 */
export function buildTree(nodes: MindNode[], edges: MindEdge[], rootId?: string) {
  const root = rootId ?? findRootId(nodes, edges);
  const parent = new Map<string, string | null>();
  const children = new Map<string, string[]>();
  if (!root) return { root, parent, children };

  const adjacency = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push(b);
  };
  for (const e of edges) {
    link(e.source, e.target);
    link(e.target, e.source);
  }

  parent.set(root, null);
  const queue = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    children.set(cur, []);
    for (const next of adjacency.get(cur) ?? []) {
      if (parent.has(next)) continue;
      parent.set(next, cur);
      children.get(cur)!.push(next);
      queue.push(next);
    }
  }
  return { root, parent, children };
}

/** Taille de police selon la profondeur dans l'arbre généré. */
function fontSizeForDepth(depth: number) {
  return depth === 0 ? 22 : depth === 1 ? 17 : 15;
}

export interface AiConversion {
  nodes: MindNode[];
  edges: MindEdge[];
  /** id Claude → id du nœud créé */
  idMap: Map<string, string>;
}

/**
 * Transforme la réponse de Claude en nœuds et liens React Flow (sans position).
 * `existing` associe les ids Claude des nœuds déjà présents à leurs vrais ids.
 */
export function aiToFlow(
  ai: AiMap,
  edgeData: MindEdgeData,
  existing: { idMap: Map<string, string>; depthOf: (realId: string) => number; rootRealId?: string } | null = null,
): AiConversion {
  const idMap = new Map<string, string>();
  for (const n of ai.noeuds) idMap.set(n.id, newId());

  const byAiId = new Map(ai.noeuds.map((n) => [n.id, n]));
  const depthCache = new Map<string, number>();
  const depth = (aiId: string, guard = 0): number => {
    if (depthCache.has(aiId)) return depthCache.get(aiId)!;
    const n = byAiId.get(aiId);
    let d = 0;
    if (n?.parentId != null && guard < 500) {
      if (byAiId.has(n.parentId)) d = depth(n.parentId, guard + 1) + 1;
      else if (existing?.idMap.has(n.parentId)) d = existing.depthOf(existing.idMap.get(n.parentId)!) + 1;
      else d = 1;
    } else if (existing) {
      d = 1;
    }
    depthCache.set(aiId, d);
    return d;
  };

  const nodes: MindNode[] = [];
  const edges: MindEdge[] = [];
  for (const n of ai.noeuds) {
    const d = depth(n.id);
    const bgColor = normalizeHex(n.couleur) ?? (d === 0 ? ROOT_COLOR : BRANCH_COLORS[0]);
    const isRoot = !existing && n.parentId === null;
    nodes.push({
      id: idMap.get(n.id)!,
      type: "mind",
      position: { x: 0, y: 0 },
      data: defaultNodeData({
        label: n.texte,
        emoji: n.emoji,
        bgColor,
        textColor: contrastText(bgColor),
        fontSize: fontSizeForDepth(d),
        bold: d <= 1,
        ...(isRoot ? { isRoot: true } : {}),
      }),
    });

    let parentReal: string | undefined;
    if (n.parentId !== null) parentReal = idMap.get(n.parentId) ?? existing?.idMap.get(n.parentId);
    else if (existing) parentReal = existing.rootRealId;
    if (parentReal) edges.push(makeEdge(parentReal, idMap.get(n.id)!, edgeData));
  }
  return { nodes, edges, idMap };
}

/**
 * Prépare la carte actuelle pour Claude : ids courts (n1, n2…) pour économiser des tokens
 * et éviter les erreurs de recopie, et structure parent/enfant explicite.
 */
export function flowToAi(nodes: MindNode[], edges: MindEdge[], title: string) {
  const { root, parent } = buildTree(nodes, edges);
  const ordered = [...nodes].sort((a, b) => (a.id === root ? -1 : b.id === root ? 1 : 0));
  const toShort = new Map<string, string>();
  ordered.forEach((n, i) => toShort.set(n.id, `n${i + 1}`));
  const toReal = new Map<string, string>([...toShort].map(([real, short]) => [short, real]));

  const carte: AiMap = {
    titre: title,
    noeuds: ordered.map((n) => {
      const p = parent.get(n.id);
      return {
        id: toShort.get(n.id)!,
        texte: n.data.label || "(sans texte)",
        parentId: p ? toShort.get(p)! : null,
        couleur: n.data.bgColor,
        emoji: n.data.emoji,
      };
    }),
  };
  return { carte, toShort, toReal };
}
