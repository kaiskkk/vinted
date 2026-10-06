import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AiMap } from "../shared/aiMap";
import { createApi, createFetchHandler } from "./api";
import { createApp } from "./app";

const carte: AiMap = {
  titre: "Foot",
  noeuds: [
    { id: "n1", texte: "Foot", parentId: null, couleur: "#312e81", emoji: "⚽" },
    { id: "n2", texte: "Physique", parentId: "n1", couleur: "#ef4444", emoji: "" },
  ],
};

function fakeApi(accessCode?: string) {
  let calls = 0;
  const api = createApi({
    generator: {
      generate: async () => {
        calls++;
        return carte;
      },
    },
    hasApiKey: () => true,
    accessCode: () => accessCode,
  });
  return { api, calls: () => calls };
}

describe("code d'accès", () => {
  it("n'exige rien quand CODE_ACCES est vide", async () => {
    const { api } = fakeApi(undefined);
    const res = await api.generate({ mode: "replace", prompt: "x" });
    expect(res.status).toBe(200);
  });

  it("refuse sans code, avec un code faux, et accepte le bon", async () => {
    const { api, calls } = fakeApi("secret");
    const none = await api.generate({ mode: "replace", prompt: "x" });
    expect(none.status).toBe(401);
    expect(none.body).toMatchObject({ code: "CODE_REQUIS" });
    const wrong = await api.expand({ carte, nodeId: "n1" }, "nope");
    expect(wrong.body).toMatchObject({ code: "CODE_INVALIDE" });
    expect(calls()).toBe(0);
    const ok = await api.generate({ mode: "replace", prompt: "x" }, "secret");
    expect(ok.status).toBe(200);
    expect(calls()).toBe(1);
  });

  it("le serveur Express lit l'en-tête X-Code-Acces", async () => {
    const app = createApp({ generator: { generate: async () => carte }, hasApiKey: () => true, accessCode: () => "secret" });
    expect((await request(app).get("/api/health")).body.codeRequis).toBe(true);
    expect((await request(app).post("/api/generate").send({ mode: "replace", prompt: "x" })).status).toBe(401);
    const ok = await request(app).post("/api/generate").set("X-Code-Acces", "secret").send({ mode: "replace", prompt: "x" });
    expect(ok.status).toBe(200);
  });
});

describe("gestionnaire Netlify (Request → Response)", () => {
  const post = (path: string, body: string, headers: Record<string, string> = {}) =>
    new Request(`https://exemple.netlify.app${path}`, { method: "POST", body, headers: { "content-type": "application/json", ...headers } });

  it("répond à /api/health", async () => {
    const handler = createFetchHandler(fakeApi().api);
    const res = await handler(new Request("https://exemple.netlify.app/api/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, cleApi: true, codeRequis: false });
  });

  it("génère, développe et valide les requêtes", async () => {
    const handler = createFetchHandler(fakeApi().api);
    const gen = await handler(post("/api/generate", JSON.stringify({ mode: "replace", prompt: "foot" })));
    expect(gen.status).toBe(200);
    expect(((await gen.json()) as { noeuds: unknown[] }).noeuds).toHaveLength(2);

    const bad = await handler(post("/api/generate", "{oups"));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { erreur: string }).erreur).toMatch(/JSON/);

    const missing = await handler(post("/api/expand", JSON.stringify({ carte, nodeId: "n99" })));
    expect(missing.status).toBe(400);

    const getGen = await handler(new Request("https://exemple.netlify.app/api/generate"));
    expect(getGen.status).toBe(405);
    const unknown = await handler(post("/api/autre", "{}"));
    expect(unknown.status).toBe(404);
  });

  it("transmet le code d'accès", async () => {
    const handler = createFetchHandler(fakeApi("secret").api);
    const denied = await handler(post("/api/generate", JSON.stringify({ mode: "replace", prompt: "x" })));
    expect(denied.status).toBe(401);
    const ok = await handler(post("/api/generate", JSON.stringify({ mode: "replace", prompt: "x" }), { "X-Code-Acces": "secret" }));
    expect(ok.status).toBe(200);
  });
});
