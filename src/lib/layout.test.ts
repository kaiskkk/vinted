import { describe, expect, it } from "vitest";
import { sanitizeAiMap } from "../../shared/aiMap";
import type { MindEdge, MindNode } from "../types";
import { estimateSize, layoutTree, nodeSize, placeNewNodes } from "./layout";
import { DEFAULT_EDGE, aiToFlow, defaultNodeData, flowToAi, makeEdge, rootNode } from "./mapModel";

function sampleMap() {
  const ai = sanitizeAiMap({
    titre: "Devenir footballeur pro",
    noeuds: [
      { id: "r", texte: "Devenir footballeur pro", parentId: null, couleur: "#312e81", emoji: "⚽" },
      ...["Physique", "Technique", "Mental", "Carrière", "Nutrition"].flatMap((b, i) => [
        { id: `b${i}`, texte: b, parentId: "r", couleur: "#ef4444", emoji: "" },
        ...[1, 2, 3].map((k) => ({ id: `b${i}-${k}`, texte: `${b} idée ${k}`, parentId: `b${i}`, couleur: "#ef4444", emoji: "" })),
      ]),
    ],
  });
  return aiToFlow(ai, DEFAULT_EDGE);
}

function boxes(nodes: MindNode[], positions: Map<string, { x: number; y: number }>) {
  return nodes.map((n) => ({ id: n.id, ...(positions.get(n.id) ?? n.position), ...nodeSize(n) }));
}

function overlapping(list: ReturnType<typeof boxes>) {
  const pairs: string[] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) pairs.push(`${a.id}/${b.id}`);
    }
  return pairs;
}

describe("aiToFlow", () => {
  it("crée un nœud et un lien par idée, avec le nœud central marqué", () => {
    const { nodes, edges } = sampleMap();
    expect(nodes).toHaveLength(21);
    expect(edges).toHaveLength(20);
    expect(nodes.filter((n) => n.data.isRoot)).toHaveLength(1);
    expect(nodes[0].data.fontSize).toBeGreaterThan(nodes[1].data.fontSize);
  });

  it("aller-retour avec flowToAi conserve la structure", () => {
    const { nodes, edges } = sampleMap();
    const { carte, toReal } = flowToAi(nodes, edges, "Titre");
    expect(carte.noeuds[0]).toMatchObject({ id: "n1", parentId: null, texte: "Devenir footballeur pro" });
    expect(carte.noeuds.filter((n) => n.parentId === "n1")).toHaveLength(5);
    expect(toReal.get("n1")).toBe(nodes[0].id);
  });
});

describe("layoutTree", () => {
  it("dispose l'arbre sans chevauchement, des deux côtés du centre", () => {
    const { nodes, edges } = sampleMap();
    const positions = layoutTree(nodes, edges);
    expect(positions.size).toBe(nodes.length);
    expect(overlapping(boxes(nodes, positions))).toEqual([]);

    const root = nodes.find((n) => n.data.isRoot)!;
    const rootCx = positions.get(root.id)!.x + nodeSize(root).width / 2;
    const sides = nodes
      .filter((n) => !n.data.isRoot)
      .map((n) => positions.get(n.id)!.x + nodeSize(n).width / 2 > rootCx);
    expect(sides.some(Boolean)).toBe(true);
    expect(sides.some((s) => !s)).toBe(true);
  });

  it("garde le nœud central à sa place", () => {
    const { nodes, edges } = sampleMap();
    nodes[0].position = { x: 500, y: -200 };
    expect(layoutTree(nodes, edges).get(nodes[0].id)).toEqual({ x: 500, y: -200 });
  });
});

describe("placeNewNodes", () => {
  it("place de nouveaux enfants sans toucher ni chevaucher l'existant", () => {
    const { nodes, edges } = sampleMap();
    const positions = layoutTree(nodes, edges);
    const placed: MindNode[] = nodes.map((n) => ({ ...n, position: positions.get(n.id)! }));
    const before = new Map(placed.map((n) => [n.id, { ...n.position }]));

    const target = placed[1];
    const fresh: MindNode[] = [1, 2, 3, 4].map((k) => ({
      id: `new${k}`,
      type: "mind",
      position: { x: 0, y: 0 },
      data: defaultNodeData({ label: `Nouvelle ${k}` }),
    }));
    const allNodes = [...placed, ...fresh];
    const allEdges: MindEdge[] = [...edges, ...fresh.map((f) => makeEdge(target.id, f.id, DEFAULT_EDGE))];
    const result = placeNewNodes(allNodes, allEdges, new Set(fresh.map((f) => f.id)));

    expect(result.size).toBe(4);
    for (const n of placed) expect(n.position).toEqual(before.get(n.id));
    const merged = new Map([...before, ...result]);
    expect(overlapping(boxes(allNodes, merged))).toEqual([]);
  });

  it("place un premier enfant à côté d'un nœud central seul", () => {
    const root = rootNode("Idée");
    const child: MindNode = { id: "c", type: "mind", position: { x: 0, y: 0 }, data: defaultNodeData() };
    const pos = placeNewNodes([root, child], [makeEdge(root.id, "c", DEFAULT_EDGE)], new Set(["c"])).get("c")!;
    expect(pos.x).toBeGreaterThan(estimateSize(root.data).width);
  });
});
