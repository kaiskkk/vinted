import { describe, expect, it } from "vitest";
import { DEFAULT_EDGE, defaultNodeData, makeEdge, rootNode } from "./mapModel";
import { computePreview } from "./storage";
import type { MindNode } from "../types";

describe("computePreview (miniatures de l'accueil)", () => {
  it("décrit chaque nœud et chaque lien, dans une boîte réduite", () => {
    const root = rootNode("Centre");
    const child: MindNode = { id: "c", type: "mind", position: { x: 400, y: 120 }, data: defaultNodeData({ bgColor: "#22c55e" }) };
    const p = computePreview([root, child], [makeEdge(root.id, "c", DEFAULT_EDGE)])!;
    expect(p.n).toHaveLength(2);
    expect(p.e).toHaveLength(1);
    expect(p.w).toBeLessThanOrEqual(240);
    expect(p.h).toBeLessThanOrEqual(140);
    expect(p.n[1][4]).toBe("#22c55e");
    // Les coordonnées partent de 0 (carte recadrée).
    expect(Math.min(...p.n.map((n) => n[0]))).toBe(0);
  });

  it("ignore les cartes vides et les liens vers des nœuds absents", () => {
    expect(computePreview([], [])).toBeUndefined();
    const root = rootNode("Seul");
    expect(computePreview([root], [makeEdge(root.id, "fantome", DEFAULT_EDGE)])!.e).toHaveLength(0);
  });
});
