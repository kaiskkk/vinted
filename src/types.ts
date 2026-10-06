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

export interface MapSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
}

/** Élément glissé depuis la boîte à outils vers le canevas. */
export type DragPayload =
  | { kind: "shape"; shape: Shape }
  | { kind: "emoji"; emoji: string }
  | { kind: "color"; target: "bg" | "text"; color: string };

export const DRAG_MIME = "application/x-carte-mentale";
