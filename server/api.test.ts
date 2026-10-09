import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AiMap } from "../shared/aiMap";
import { createApi, createFetchHandler } from "./api";
import { createApp } from "./app";
import type { StudyAI } from "./study";

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

describe("outils d'étude", () => {
  const study: StudyAI = {
    etude: async (input) => {
      if (input.type === "quiz") {
        return {
          titre: "Quiz",
          questions: Array.from({ length: 8 }, (_, i) => ({
            question: `Question ${i + 1} ?`,
            choix: ["A", "B", "C", "D"],
            bonneReponse: i % 4,
            explication: "Parce que.",
          })),
        };
      }
      if (input.type === "fiche") return { titre: "Fiche", sousTitre: "", blocs: [] };
      return { titre: "Cartes", cartes: [{ recto: "Recto", verso: "Verso" }] };
    },
    copie: async (input) => ({
      titre: "Contrôle",
      matiere: input.matiere ?? "",
      note: "12/20",
      bilan: "Bon travail.",
      pointsForts: ["Calculs justes"],
      erreurs: [{ extrait: "2 + 2 = 5", explication: "Erreur de calcul.", correction: "4", conseil: "Vérifie chaque calcul." }],
      notions: ["Additions"],
      exercices: [{ titre: "Ex", enonce: "Calcule 3 + 4.", indices: ["Compte sur tes doigts"], etapes: ["3 + 4 = 7"], reponse: "7" }],
    }),
    redaction: async (input) =>
      input.mode === "plan"
        ? {
            problematiques: ["Pourquoi ?"],
            introduction: {},
            parties: [{ titre: "I. Les causes", sousParties: [{ titre: "A", idees: ["x"], exemples: [] }] }],
            conclusion: {},
            conseils: [],
          }
        : { appreciation: "Bon début.", pointsForts: ["Clair"], aAmeliorer: [], langue: [], prochaineEtape: "Ajoute des exemples." },
    chat: async (input) => `Réponse à : ${input.question}`,
    simplifier: async () => "Plus simple.",
    lire: async () => "Texte lu",
  };
  const api = createApi({ generator: { generate: async () => carte }, study, hasApiKey: () => true });

  it("nettoie et plafonne le quiz au nombre demandé", async () => {
    const res = await api.etude({ type: "quiz", cours: "Le cours", nombre: 5, difficulte: "facile" });
    expect(res.status).toBe(200);
    expect((res.body as { questions: unknown[] }).questions).toHaveLength(5);
  });

  it("refuse une demande sans cours ni sujet, ou d'un type inconnu", async () => {
    const empty = await api.etude({ type: "fiche", cours: "  " });
    expect(empty.status).toBe(400);
    expect((empty.body as { erreur: string }).erreur).toMatch(/cours ou un sujet/);
    expect((await api.etude({ type: "poeme", sujet: "x" })).status).toBe(400);
    expect((await api.etude({ type: "quiz", sujet: "x", nombre: 500 })).status).toBe(400);
  });

  it("signale une réponse vide de Claude", async () => {
    const res = await api.etude({ type: "fiche", sujet: "Les volcans" });
    expect(res.status).toBe(502);
    expect((res.body as { erreur: string }).erreur).toMatch(/exploitable/);
  });

  it("répond aux questions, simplifie et lit une photo", async () => {
    const chat = await api.chat({ sujet: "Volcans", question: "C'est quoi le magma ?", historique: [] });
    expect(chat.body).toEqual({ reponse: "Réponse à : C'est quoi le magma ?" });
    expect((await api.simplifier({ texte: "Un passage compliqué" })).body).toEqual({ explication: "Plus simple." });
    expect((await api.lire({ media: "image/jpeg", data: "aGVsbG8=" })).body).toEqual({ texte: "Texte lu" });
    expect((await api.lire({ media: "image/heic", data: "aGVsbG8=" })).status).toBe(400);
    expect((await api.lire({ media: "image/png", data: "<script>" })).status).toBe(400);
  });

  it("analyse d'une copie corrigée : photos validées, réponse nettoyée", async () => {
    const ok = await api.copie({ images: [{ media: "image/jpeg", data: "aGVsbG8=" }], matiere: "Maths", niveau: "college" });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ note: "12/20", matiere: "Maths", erreurs: [{ correction: "4" }], exercices: [{ reponse: "7" }] });
    expect((await api.copie({ images: [] })).body).toMatchObject({ erreur: "Ajoute au moins une photo de ta copie." });
    expect((await api.copie({ images: [{ media: "application/pdf", data: "aGVsbG8=" }] })).status).toBe(400);
    const cinq = Array.from({ length: 5 }, () => ({ media: "image/png", data: "aGVsbG8=" }));
    expect((await api.copie({ images: cinq })).body).toMatchObject({ erreur: "4 pages au maximum à la fois." });
  });

  it("aide à la rédaction : plan, relecture, validation", async () => {
    const plan = await api.redaction({ mode: "plan", typeDevoir: "dissertation", sujet: "La guerre est-elle inévitable ?" });
    expect(plan.status).toBe(200);
    expect(plan.body).toMatchObject({ parties: [{ titre: "I. Les causes" }], introduction: { accroche: "" } });
    const relu = await api.redaction({ mode: "relecture", typeDevoir: "redaction", sujet: "Raconte", texte: "Il était une fois…" });
    expect(relu.body).toMatchObject({ appreciation: "Bon début." });
    expect((await api.redaction({ mode: "relecture", typeDevoir: "redaction", sujet: "Raconte", texte: " " })).status).toBe(400);
    expect((await api.redaction({ mode: "plan", typeDevoir: "poeme", sujet: "x" })).status).toBe(400);
    expect((await api.redaction({ mode: "plan", typeDevoir: "expose", sujet: "" })).status).toBe(400);
  });

  it("répond 503 sans outils d'étude, et exige le code d'accès", async () => {
    const without = createApi({ generator: { generate: async () => carte }, hasApiKey: () => true });
    expect((await without.chat({ sujet: "x", question: "y" })).status).toBe(503);
    const locked = createApi({ generator: { generate: async () => carte }, study, hasApiKey: () => true, accessCode: () => "secret" });
    expect((await locked.etude({ type: "quiz", sujet: "x" })).status).toBe(401);
  });

  it("accepte une photo plus lourde que les autres requêtes", async () => {
    const handler = createFetchHandler(api);
    const big = JSON.stringify({ media: "image/jpeg", data: "A".repeat(1_500_000) });
    const post = (path: string, body: string) =>
      handler(new Request(`https://exemple.netlify.app${path}`, { method: "POST", body, headers: { "content-type": "application/json" } }));
    expect((await post("/api/lire", big)).status).toBe(200);
    expect((await post("/api/chat", big)).status).toBe(413);

    const app = createApp({ generator: { generate: async () => carte }, study, hasApiKey: () => true });
    expect(
      (
        await request(app)
          .post("/api/lire")
          .send({ media: "image/jpeg", data: "A".repeat(1_500_000) })
      ).status,
    ).toBe(200);
    expect((await request(app).post("/api/etude").send({ type: "flashcards", sujet: "Volcans", nombre: 3 })).body).toMatchObject({
      cartes: [{ recto: "Recto", verso: "Verso" }],
    });
  });
});
