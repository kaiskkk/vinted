import type { Edge, Node, Viewport } from "@xyflow/react";

export type Shape = "circle" | "rectangle" | "rounded" | "diamond" | "cloud" | "postit";

export type MindNodeData = {
  label: string;
  emoji: string;
  shape: Shape;
  bgColor: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  isRoot?: boolean;
  /** Transitoire : affiché pendant « Développer avec Claude », jamais sauvegardé. */
  loading?: boolean;
};

export type MindNode = Node<MindNodeData, "mind">;

export type EdgePath = "straight" | "bezier" | "step";

export type MindEdgeData = {
  path: EdgePath;
  dashed: boolean;
  arrow: boolean;
};

export type MindEdge = Edge<MindEdgeData, "floating">;

export interface MindMap {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: MindNode[];
  edges: MindEdge[];
  edgeDefaults: MindEdgeData;
  viewport?: Viewport;
}

/** Miniature d'une carte : rectangles [x, y, largeur, hauteur, couleur] et traits [x1, y1, x2, y2, couleur]. */
export interface MapPreview {
  w: number;
  h: number;
  n: [number, number, number, number, string][];
  e: [number, number, number, number, string][];
}

export interface MapSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  /** Ajouté dans la version 2 ; calculé à la volée pour les cartes plus anciennes. */
  preview?: MapPreview;
}

/** Élément glissé depuis la boîte à outils vers le canevas. */
export type DragPayload =
  | { kind: "shape"; shape: Shape }
  | { kind: "emoji"; emoji: string }
  | { kind: "color"; target: "bg" | "text"; color: string };

export const DRAG_MIME = "application/x-carte-mentale";
