import { Graph, layout as dagreLayout } from "@dagrejs/dagre";
import type { XYPosition } from "@xyflow/react";
import type { MindEdge, MindNode, MindNodeData, Shape } from "../types";
import { buildTree } from "./mapModel";

type Size = { width: number; height: number };
type Box = { x: number; y: number; width: number; height: number };
type Direction = "LR" | "RL";

const NODE_SEP = 22;
const RANK_SEP = 72;
const COLLISION_MARGIN = 14;

/** Largeur maximale du texte dans un nœud (doit correspondre au CSS de MindNode). */
export const LABEL_MAX_WIDTH = 240;

/** Marges intérieures d'une forme, proportionnelles à la taille du texte (utilisées par MindNode). */
export function shapePadding(shape: Shape, fontSize: number): { x: number; y: number } {
  const k = {
    rectangle: [1.1, 0.65],
    rounded: [1.3, 0.75],
    circle: [0.9, 0.9],
    diamond: [2.6, 1.6],
    cloud: [2.3, 1.6],
    postit: [1.0, 1.1],
  }[shape];
  return { x: Math.round(k[0] * fontSize), y: Math.round(k[1] * fontSize) };
}

export const POSTIT_MIN = { width: 140, height: 110 };

/** Taille approximative d'un nœud qui n'a pas encore été affiché. */
export function estimateSize(d: MindNodeData): Size {
  const charWidth = d.fontSize * 0.56 * (d.bold ? 1.06 : 1);
  const chars = d.label.length + (d.emoji ? 2.5 : 0);
  const rawWidth = chars * charWidth;
  const textWidth = Math.min(LABEL_MAX_WIDTH, Math.max(24, rawWidth));
  const lines = Math.max(1, Math.ceil(rawWidth / LABEL_MAX_WIDTH));
  const pad = shapePadding(d.shape, d.fontSize);
  let width = textWidth + pad.x * 2;
  let height = lines * d.fontSize * 1.3 + pad.y * 2;
  if (d.shape === "circle") width = height = Math.max(width, height);
  if (d.shape === "postit") {
    width = Math.max(width, POSTIT_MIN.width);
    height = Math.max(height, POSTIT_MIN.height);
  }
  return { width, height };
}

export function nodeSize(n: MindNode): Size {
  const w = n.measured?.width;
  const h = n.measured?.height;
  return w && h ? { width: w, height: h } : estimateSize(n.data);
}

function center(n: MindNode, size: Size): XYPosition {
  return { x: n.position.x + size.width / 2, y: n.position.y + size.height / 2 };
}

/** Disposition dagre d'un sous-arbre, en coordonnées relatives au centre de `anchor`. */
function layoutBranch(
  anchor: string,
  firstLevel: string[],
  children: Map<string, string[]>,
  sizes: Map<string, Size>,
  dir: Direction,
  include: (id: string) => boolean = () => true,
): Map<string, XYPosition> {
  const g = new Graph();
  g.setGraph({ rankdir: dir, nodesep: NODE_SEP, ranksep: RANK_SEP, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  g.setNode(anchor, { ...sizes.get(anchor)! });

  const queue: [string, string][] = firstLevel.map((c) => [anchor, c]);
  while (queue.length) {
    const [parent, id] = queue.shift()!;
    g.setNode(id, { ...sizes.get(id)! });
    g.setEdge(parent, id);
    for (const c of children.get(id) ?? []) if (include(c)) queue.push([id, c]);
  }

  dagreLayout(g);
  const origin = g.node(anchor);
  const out = new Map<string, XYPosition>();
  for (const id of g.nodes()) {
    const n = g.node(id);
    out.set(id, { x: n.x - origin.x, y: n.y - origin.y });
  }
  return out;
}

function subtreeSize(id: string, children: Map<string, string[]>): number {
  let count = 1;
  for (const c of children.get(id) ?? []) count += subtreeSize(c, children);
  return count;
}

/**
 * Disposition complète en arbre autour du nœud central : les branches principales
 * sont réparties à droite puis à gauche (sens horaire) pour équilibrer la carte.
 * Le nœud central garde sa position ; les nœuds isolés ne bougent pas.
 */
export function layoutTree(nodes: MindNode[], edges: MindEdge[]): Map<string, XYPosition> {
  const result = new Map<string, XYPosition>();
  const { root, children } = buildTree(nodes, edges);
  if (!root) return result;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizes = new Map(nodes.map((n) => [n.id, nodeSize(n)]));
  const rootNode = byId.get(root)!;
  const rootCenter = center(rootNode, sizes.get(root)!);

  const branches = children.get(root) ?? [];
  const weights = branches.map((b) => subtreeSize(b, children));
  const total = weights.reduce((a, b) => a + b, 0);
  const right: string[] = [];
  const left: string[] = [];
  let acc = 0;
  branches.forEach((b, i) => {
    if (acc < total / 2 || right.length === 0) {
      right.push(b);
      acc += weights[i];
    } else {
      left.push(b);
    }
  });
  left.reverse();

  const place = (rel: Map<string, XYPosition>) => {
    for (const [id, p] of rel) {
      const s = sizes.get(id)!;
      result.set(id, { x: rootCenter.x + p.x - s.width / 2, y: rootCenter.y + p.y - s.height / 2 });
    }
  };
  if (right.length) place(layoutBranch(root, right, children, sizes, "LR"));
  if (left.length) place(layoutBranch(root, left, children, sizes, "RL"));
  result.set(root, { ...rootNode.position });
  return result;
}

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + b.width + COLLISION_MARGIN &&
    a.x + a.width + COLLISION_MARGIN > b.x &&
    a.y < b.y + b.height + COLLISION_MARGIN &&
    a.y + a.height + COLLISION_MARGIN > b.y
  );
}

/**
 * Place uniquement les nouveaux nœuds (`newIds`) sans toucher aux autres :
 * chaque nouveau sous-arbre est disposé du côté extérieur de son parent,
 * puis décalé verticalement jusqu'à ne plus chevaucher de nœud existant.
 */
export function placeNewNodes(nodes: MindNode[], edges: MindEdge[], newIds: Set<string>): Map<string, XYPosition> {
  const result = new Map<string, XYPosition>();
  const { root, parent, children } = buildTree(nodes, edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizes = new Map(nodes.map((n) => [n.id, nodeSize(n)]));
  if (!root) return result;

  const rootCenter = center(byId.get(root)!, sizes.get(root)!);
  const obstacles: Box[] = [];
  let rightCount = 0;
  let leftCount = 0;
  for (const n of nodes) {
    if (newIds.has(n.id)) continue;
    const s = sizes.get(n.id)!;
    obstacles.push({ x: n.position.x, y: n.position.y, ...s });
    if (n.id === root) continue;
    if (center(n, s).x >= rootCenter.x) rightCount++;
    else leftCount++;
  }

  // Regroupe les nouveaux nœuds par nœud existant auquel ils se rattachent.
  const groups: { anchor: string; firstLevel: string[] }[] = [];
  const orphans: string[] = [];
  for (const id of newIds) {
    const p = parent.get(id);
    if (p === undefined) {
      orphans.push(id);
      continue;
    }
    if (p === null || newIds.has(p)) continue;
    if (p === root) {
      groups.push({ anchor: p, firstLevel: [id] });
    } else {
      const g = groups.find((x) => x.anchor === p && p !== root);
      if (g) g.firstLevel.push(id);
      else groups.push({ anchor: p, firstLevel: [id] });
    }
  }

  for (const { anchor, firstLevel } of groups) {
    const anchorNode = byId.get(anchor)!;
    const anchorCenter = center(anchorNode, sizes.get(anchor)!);
    let dir: Direction;
    if (anchor === root) dir = rightCount <= leftCount ? "LR" : "RL";
    else dir = anchorCenter.x >= rootCenter.x ? "LR" : "RL";

    const rel = layoutBranch(anchor, firstLevel, children, sizes, dir, (id) => newIds.has(id));
    rel.delete(anchor);
    const boxes = [...rel].map(([id, p]) => {
      const s = sizes.get(id)!;
      return { id, x: anchorCenter.x + p.x - s.width / 2, y: anchorCenter.y + p.y - s.height / 2, ...s };
    });

    // Décalages essayés : 0, puis en dessous / au-dessus, de plus en plus loin.
    const step = 32;
    let offset = 0;
    for (let i = 0; i < 80; i++) {
      const candidate = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2) * step;
      if (!boxes.some((b) => obstacles.some((o) => overlaps({ ...b, y: b.y + candidate }, o)))) {
        offset = candidate;
        break;
      }
    }

    for (const b of boxes) {
      const box = { x: b.x, y: b.y + offset, width: b.width, height: b.height };
      result.set(b.id, { x: box.x, y: box.y });
      obstacles.push(box);
    }
    if (dir === "LR") rightCount += boxes.length;
    else leftCount += boxes.length;
  }

  // Nœuds sans lien vers la carte : sous le nœud central.
  orphans.forEach((id, i) => {
    const s = sizes.get(id)!;
    result.set(id, { x: rootCenter.x - s.width / 2, y: rootCenter.y + 140 + i * (s.height + 16) });
  });
  return result;
}
