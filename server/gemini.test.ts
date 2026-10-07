import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAI } from "./ai";
import { CarteSchema } from "./claude";
import { createGeminiProvider, parseJson, toGeminiSchema } from "./gemini";

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

function fakeFetch(responses: { status?: number; json: unknown }[]) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const answer = (text: string, finishReason = "STOP") => ({ candidates: [{ finishReason, content: { parts: [{ text }] } }] });

describe("Gemini (IA gratuite)", () => {
  beforeEach(() => {
    process.env.CLE_GEMINI = "cle-test";
    delete process.env.MODELE_GEMINI;
  });
  afterEach(() => {
    delete process.env.CLE_GEMINI;
  });

  it("convertit les schémas zod au format Gemini", () => {
    const s = toGeminiSchema(CarteSchema);
    expect(s.type).toBe("OBJECT");
    expect(s.required).toEqual(["titre", "noeuds"]);
    const noeud = s.properties!.noeuds.items!;
    expect(noeud.type).toBe("OBJECT");
    expect(noeud.properties!.parentId).toMatchObject({ type: "STRING", nullable: true });
    expect(noeud.propertyOrdering?.[0]).toBe("id");
  });

  it("génère une fiche : clé en en-tête, consignes, JSON structuré", async () => {
    const { fn, calls } = fakeFetch([{ json: answer(JSON.stringify({ titre: "Volcans", sousTitre: "", blocs: [] })) }]);
    const { study } = createGeminiProvider({}, fn);
    const raw = await study.etude({ type: "fiche", sujet: "Les volcans", niveau: "college" });
    expect(raw).toMatchObject({ titre: "Volcans" });
    const call = calls[0];
    expect(call.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent");
    expect((call.init.headers as Record<string, string>)["x-goog-api-key"]).toBe("cle-test");
    expect(call.url).not.toContain("cle-test");
    const config = call.body.generationConfig as Record<string, unknown>;
    expect(config.responseMimeType).toBe("application/json");
    expect((config.responseSchema as { type: string }).type).toBe("OBJECT");
    // Réflexion au minimum pour répondre vite.
    expect(config.thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect(JSON.stringify(call.body.systemInstruction)).toContain("collège");
    expect(JSON.stringify(call.body.contents)).toContain("Les volcans");
  });

  it("discussion : historique en rôles user / model, réponse en texte", async () => {
    const { fn, calls } = fakeFetch([{ json: answer("Le magma est de la roche fondue.") }]);
    const { study } = createGeminiProvider({}, fn);
    const text = await study.chat({
      cours: "Cours sur les volcans",
      historique: [
        { role: "assistant", texte: "ignoré : l'historique commence par l'élève" },
        { role: "user", texte: "Bonjour" },
        { role: "assistant", texte: "Salut" },
      ],
      question: "C'est quoi le magma ?",
    });
    expect(text).toBe("Le magma est de la roche fondue.");
    const roles = (calls[0].body.contents as { role: string }[]).map((c) => c.role);
    expect(roles).toEqual(["user", "model", "user"]);
    expect(calls[0].body.generationConfig).not.toHaveProperty("responseMimeType");
  });

  it("lit une photo envoyée en base64", async () => {
    const { fn, calls } = fakeFetch([{ json: answer("La photosynthèse…") }]);
    const { study } = createGeminiProvider({}, fn);
    expect(await study.lire({ media: "image/jpeg", data: "aGVsbG8=" })).toBe("La photosynthèse…");
    expect(JSON.stringify(calls[0].body.contents)).toContain('"inlineData":{"mimeType":"image/jpeg","data":"aGVsbG8="}');
    const { fn: vide } = fakeFetch([{ json: answer("AUCUN TEXTE") }]);
    await expect(createGeminiProvider({}, vide).study.lire({ media: "image/png", data: "aGVsbG8=" })).rejects.toMatchObject({ status: 422 });
  });

  it("traduit les erreurs en messages clairs", async () => {
    const cases: [number, string, number, RegExp][] = [
      [429, "Resource has been exhausted", 429, /Limite gratuite/],
      [400, "API key not valid. Please pass a valid API key.", 401, /Clé Gemini invalide/],
      [404, "models/xyz is not found", 404, /introuvable/],
      [503, "The model is overloaded", 503, /surchargée/],
    ];
    for (const [status, message, expected, text] of cases) {
      const { fn } = fakeFetch([{ status, json: { error: { code: status, message } } }]);
      await expect(createGeminiProvider({}, fn).study.simplifier({ texte: "x" })).rejects.toMatchObject({
        status: expected,
        message: expect.stringMatching(text),
      });
    }
  });

  it("refus, réponse coupée et réessai après une panne passagère", async () => {
    const { fn: refus } = fakeFetch([{ json: answer("", "SAFETY") }]);
    await expect(createGeminiProvider({}, refus).generator.generate({ mode: "replace", prompt: "x" })).rejects.toMatchObject({ status: 422 });
    const { fn: coupe } = fakeFetch([{ json: answer('{"titre": "Vol', "MAX_TOKENS") }]);
    await expect(createGeminiProvider({}, coupe).study.etude({ type: "quiz", sujet: "x" })).rejects.toMatchObject({
      status: 502,
      message: expect.stringMatching(/coupée/),
    });
    const { fn: panne, calls } = fakeFetch([
      { status: 503, json: { error: { message: "overloaded" } } },
      { json: answer('{"explication": "Plus simple."}') },
    ]);
    expect(await createGeminiProvider({ maxRetries: 1 }, panne).study.simplifier({ texte: "x" })).toBe("Plus simple.");
    expect(calls).toHaveLength(2);
  });

  it("limite atteinte sur un modèle : bascule sur un autre", async () => {
    const { fn, calls } = fakeFetch([{ status: 429, json: { error: { message: "quota" } } }, { json: answer('{"titre":"T","noeuds":[]}') }]);
    expect(await createGeminiProvider({}, fn).generator.generate({ mode: "replace", prompt: "x" })).toEqual({ titre: "T", noeuds: [] });
    expect(calls.map((c) => c.url.split("/").pop())).toEqual(["gemini-flash-lite-latest:generateContent", "gemini-2.5-flash-lite:generateContent"]);
  });

  it("dernier essai sans schéma imposé, avec le schéma dans la consigne", async () => {
    const erreurs = Array.from({ length: 4 }, () => ({ status: 500, json: { error: { message: "Internal error" } } }));
    const { fn, calls } = fakeFetch([...erreurs, { json: answer('{"explication": "Ok"}') }]);
    expect(await createGeminiProvider({}, fn).study.simplifier({ texte: "x" })).toBe("Ok");
    expect(calls).toHaveLength(5);
    const last = calls[4].body;
    expect(last.generationConfig).not.toHaveProperty("responseSchema");
    expect(last.generationConfig).toHaveProperty("responseMimeType", "application/json");
    expect(JSON.stringify(last.systemInstruction)).toContain("respecte ce schéma");
    expect(calls[4].url).toContain("/gemini-flash-lite-latest:");
  });

  it("réessaie sans réglage de réflexion si le modèle le refuse", async () => {
    const { fn, calls } = fakeFetch([
      { status: 400, json: { error: { message: "Thinking level is not supported for this model." } } },
      { json: answer('{"explication": "Ok"}') },
    ]);
    expect(await createGeminiProvider({}, fn).study.simplifier({ texte: "x" })).toBe("Ok");
    expect(calls[1].url).toBe(calls[0].url);
    expect(calls[1].body.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  it("lit un JSON entouré de balises de code", () => {
    expect(parseJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(() => parseJson("pas du json")).toThrow(/illisible/);
  });

  it("choisit Gemini seulement quand CLE_GEMINI existe", () => {
    const ai = createAI();
    expect(ai.modelName()).toBe("gemini-flash-lite-latest");
    expect(ai.hasApiKey()).toBe(true);
    process.env.MODELE_GEMINI = "gemini-2.5-flash-lite";
    expect(ai.modelName()).toBe("gemini-2.5-flash-lite");
    delete process.env.CLE_GEMINI;
    expect(ai.modelName()).toBe("claude-sonnet-5-5");
    process.env.GEMINIE = "cle-test";
    expect(ai.modelName()).toBe("gemini-2.5-flash-lite");
    delete process.env.GEMINIE;
  });
});
