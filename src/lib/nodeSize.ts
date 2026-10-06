// Tailles des nœuds, sans dépendance lourde : utilisé par l'éditeur, la disposition et les miniatures.
import type { MindNode, MindNodeData, Shape } from "../types";

export type Size = { width: number; height: number };

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
