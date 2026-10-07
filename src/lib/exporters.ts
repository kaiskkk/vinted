import type { Rect } from "@xyflow/react";
import { sanitizeAiMap } from "../../shared/aiMap";
import type { MindEdge, MindEdgeData, MindMap, MindNode } from "../types";
import { layoutTree } from "./layout";
import { aiToFlow } from "./mapModel";
import { hydrateMap } from "./storage";

const FORMAT = "cartes-mentales";

export function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "carte-mentale"
  );
}

export function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Exporte tout le contenu de la carte (pas seulement la partie visible) en PNG haute définition. */
export async function exportPng(bounds: Rect, name: string, background: string) {
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport || bounds.width === 0) throw new Error("La carte est vide.");
  const padding = 64;
  const width = Math.ceil(bounds.width + padding * 2);
  const height = Math.ceil(bounds.height + padding * 2);
  // Limite la taille de l'image pour les très grandes cartes.
  const pixelRatio = Math.max(1, Math.min(2, 8000 / Math.max(width, height)));
  const { toPng } = await import("html-to-image"); // chargé seulement au moment d'exporter

  const dataUrl = await toPng(viewport, {
    backgroundColor: background,
    width,
    height,
    pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${padding - bounds.x}px, ${padding - bounds.y}px) scale(1)`,
    },
    filter: (el) => !(el instanceof HTMLElement && (el.classList.contains("react-flow__handle") || el.dataset.export === "ignore")),
  });
  download(dataUrl, `${slugify(name)}.png`);
}

export function exportJson(map: MindMap) {
  const payload = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    nom: map.name,
    nodes: map.nodes,
    edges: map.edges,
    edgeDefaults: map.edgeDefaults,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(url, `${slugify(map.name)}.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportedContent {
  name: string;
  nodes: MindNode[];
  edges: MindEdge[];
  edgeDefaults: MindEdgeData;
}

/**
 * Lit un fichier JSON exporté par l'application, ou directement au format Claude
 * `{ titre, noeuds }` (il est alors disposé automatiquement).
 */
export function parseImport(text: string, edgeDefaults: MindEdgeData): ImportedContent {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  if (!raw || typeof raw !== "object") throw new Error("Ce fichier ne contient pas de carte mentale.");
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.nodes)) {
    const map = hydrateMap({
      name: typeof obj.nom === "string" ? obj.nom : typeof obj.name === "string" ? obj.name : undefined,
      nodes: obj.nodes as MindNode[],
      edges: (Array.isArray(obj.edges) ? obj.edges : []) as MindEdge[],
      edgeDefaults: (obj.edgeDefaults as MindEdgeData | undefined) ?? edgeDefaults,
    });
    if (map.nodes.length === 0) throw new Error("Ce fichier ne contient aucun nœud.");
    return { name: map.name, nodes: map.nodes, edges: map.edges, edgeDefaults: map.edgeDefaults };
  }

  if (Array.isArray(obj.noeuds)) {
    const ai = sanitizeAiMap(obj);
    const { nodes, edges } = aiToFlow(ai, edgeDefaults);
    const positions = layoutTree(nodes, edges);
    return {
      name: ai.titre,
      nodes: nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })),
      edges,
      edgeDefaults,
    };
  }

  throw new Error("Format non reconnu : il faut un export de cette application ou un JSON { titre, noeuds }.");
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    reader.readAsText(file);
  });
}
