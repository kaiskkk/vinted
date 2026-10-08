import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AiMap } from "../shared/aiMap";
import { createApp } from "./app";
import { UserFacingError, buildUserMessage, type GenerateInput, type MindMapGenerator } from "./claude";

function appWith(generate: MindMapGenerator["generate"], hasApiKey = true) {
  const calls: GenerateInput[] = [];
  const app = createApp({
    generator: {
      generate: async (input) => {
        calls.push(input);
        return generate(input);
      },
    },
    hasApiKey: () => hasApiKey,
  });
  return { app, calls };
}

const carte: AiMap = {
  titre: "Foot",
  noeuds: [
    { id: "n1", texte: "Foot", parentId: null, couleur: "#312e81", emoji: "⚽" },
    { id: "n2", texte: "Physique", parentId: "n1", couleur: "#ef4444", emoji: "" },
  ],
};

describe("API", () => {
  it("GET /api/health indique le modèle et la présence de la clé", async () => {
    const { app } = appWith(async () => carte, false);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, modele: "claude-sonnet-5-5", cleApi: false, codeRequis: false, comptes: false });
  });

  it("refuse une demande vide avec un message en français", async () => {
    const { app, calls } = appWith(async () => carte);
    const res = await request(app).post("/api/generate").send({ mode: "replace", prompt: "   " });
    expect(res.status).toBe(400);
    expect(res.body.erreur).toMatch(/Écris d'abord/);
    expect(calls).toHaveLength(0);
  });

  it("renvoie une erreur claire sur un JSON mal formé", async () => {
    const { app } = appWith(async () => carte);
    const res = await request(app).post("/api/generate").set("Content-Type", "application/json").send("{oups");
    expect(res.status).toBe(400);
    expect(res.body.erreur).toMatch(/JSON/);
  });

  it("nettoie la carte générée en mode remplacer", async () => {
    const { app } = appWith(async () => ({
      titre: "Foot",
      noeuds: [
        { id: "a", texte: "Foot", parentId: null, couleur: "#111111", emoji: "⚽" },
        { id: "b", texte: "Technique", parentId: "inconnu", couleur: "pas une couleur", emoji: "🎯🎯" },
      ],
    }));
    const res = await request(app).post("/api/generate").send({ mode: "replace", prompt: "carte sur le foot" });
    expect(res.status).toBe(200);
    expect(res.body.noeuds[1]).toMatchObject({ parentId: "a", emoji: "🎯" });
    expect(res.body.noeuds[1].couleur).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("en mode ajouter, ne renvoie que les nouveaux nœuds rattachés à la carte", async () => {
    const { app, calls } = appWith(async () => ({
      titre: "Foot",
      noeuds: [
        { id: "n2", texte: "Physique", parentId: "n1", couleur: "#ef4444", emoji: "" },
        { id: "x1", texte: "Sommeil", parentId: "n2", couleur: "#ef4444", emoji: "😴" },
        { id: "x2", texte: "Mental", parentId: null, couleur: "#22c55e", emoji: "" },
      ],
    }));
    const res = await request(app).post("/api/generate").send({ mode: "append", prompt: "ajoute le mental", carte });
    expect(res.status).toBe(200);
    expect(calls[0].mode).toBe("append");
    expect(res.body.noeuds.map((n: { id: string; parentId: string }) => [n.id, n.parentId])).toEqual([
      ["x1", "n2"],
      ["x2", "n1"],
    ]);
  });

  it("développe un nœud : tout est rattaché sous le nœud ciblé", async () => {
    const { app, calls } = appWith(async () => ({
      titre: "Foot",
      noeuds: [
        { id: "x1", texte: "Cardio", parentId: "n1", couleur: "#ef4444", emoji: "" },
        { id: "x2", texte: "Musculation", parentId: "n2", couleur: "#ef4444", emoji: "" },
      ],
    }));
    const res = await request(app).post("/api/expand").send({ carte, nodeId: "n2" });
    expect(res.status).toBe(200);
    expect(calls[0]).toMatchObject({ mode: "expand", nodeId: "n2" });
    expect(res.body.noeuds.every((n: { parentId: string }) => n.parentId === "n2")).toBe(true);
  });

  it("refuse de développer un nœud inexistant", async () => {
    const { app } = appWith(async () => carte);
    const res = await request(app).post("/api/expand").send({ carte, nodeId: "n99" });
    expect(res.status).toBe(400);
    expect(res.body.erreur).toMatch(/introuvable/);
  });

  it("relaie les erreurs destinées à l'utilisateur", async () => {
    const { app } = appWith(async () => {
      throw new UserFacingError("Clé API manquante : ...", 500);
    });
    const res = await request(app).post("/api/generate").send({ mode: "replace", prompt: "x" });
    expect(res.status).toBe(500);
    expect(res.body.erreur).toMatch(/Clé API manquante/);
  });

  it("transforme une erreur inattendue en message lisible", async () => {
    const { app } = appWith(async () => {
      throw new Error("boom");
    });
    const res = await request(app).post("/api/generate").send({ mode: "replace", prompt: "x" });
    expect(res.status).toBe(500);
    expect(res.body.erreur).toMatch(/boom/);
  });
});

describe("buildUserMessage", () => {
  it("inclut la carte, le chemin et les enfants existants pour développer", () => {
    const msg = buildUserMessage({ mode: "expand", carte, nodeId: "n1" });
    expect(msg).toContain('"Foot" (id "n1"');
    expect(msg).toContain("Physique");
    expect(msg).toContain("3 à 6 sous-idées");
  });

  it("place la demande dans une balise dédiée", () => {
    expect(buildUserMessage({ mode: "replace", prompt: "mes objectifs" })).toContain("<demande>\nmes objectifs\n</demande>");
  });
});
