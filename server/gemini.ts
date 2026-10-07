// IA gratuite : Google Gemini (offre gratuite de Google AI Studio, sans carte bancaire).
// Utilisée à la place de Claude quand la variable CLE_GEMINI est définie.
// Mêmes consignes et mêmes formats JSON que pour Claude : le reste du site ne voit aucune différence.
import { z } from "zod";
import type { AiMap } from "../shared/aiMap";
import { CarteSchema, SYSTEM_PROMPT, UserFacingError, buildUserMessage, type GeneratorOptions, type MindMapGenerator } from "./claude";
import {
  LIRE_PROMPT,
  LIRE_SYSTEM,
  MAX_TOKENS,
  SCHEMAS,
  SimplifierSchema,
  chatContext,
  etudeInstructions,
  isNoText,
  simplifierPrompt,
  sourceBlock,
  systemPrompt,
  type StudyAI,
} from "./study";

/** Modèle « Flash » le plus récent : le seul type de modèle inclus dans l'offre gratuite. */
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiKey = () => process.env.CLE_GEMINI?.trim() || "";
export const geminiModel = () => process.env.MODELE_GEMINI?.trim() || DEFAULT_GEMINI_MODEL;

// ---------- Schéma JSON → format attendu par Gemini ----------

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  anyOf?: JsonSchema[];
};

export interface GeminiSchema {
  type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY" | "OBJECT";
  description?: string;
  nullable?: boolean;
  enum?: string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
}

function convert(s: JsonSchema): GeminiSchema {
  // « chaîne ou null » (zod .nullable()) : un seul type, marqué nullable.
  const types = (Array.isArray(s.type) ? s.type : s.type ? [s.type] : (s.anyOf ?? []).map((a) => a.type as string)).filter(Boolean);
  const nullable = types.includes("null");
  const base = types.find((t) => t !== "null") ?? "string";
  const out: GeminiSchema = { type: base.toUpperCase() as GeminiSchema["type"] };
  if (s.description) out.description = s.description;
  if (nullable) out.nullable = true;
  if (Array.isArray(s.enum)) out.enum = s.enum.map(String);
  if (base === "array" && s.items) out.items = convert(s.items);
  if (base === "object" && s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, convert(v)]));
    out.required = s.required ?? Object.keys(s.properties);
    // Gemini écrit les champs dans cet ordre (titre avant le contenu, comme Claude).
    out.propertyOrdering = Object.keys(s.properties);
  }
  return out;
}

/** Convertit un schéma zod en schéma de réponse Gemini (types en majuscules, « nullable »). */
export function toGeminiSchema(schema: z.ZodType): GeminiSchema {
  return convert(z.toJSONSchema(schema) as JsonSchema);
}

// ---------- Appel HTTP ----------

interface Part {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
}
interface Content {
  role: "user" | "model";
  parts: Part[];
}
interface GeminiRequest {
  system: string;
  contents: Content[];
  schema?: GeminiSchema;
  maxOutputTokens: number;
}

const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

/** Traduit une erreur HTTP de Google en message clair pour l'élève. */
function httpError(status: number, message: string): UserFacingError {
  const m = message.toLowerCase();
  if (status === 429) {
    return new UserFacingError(
      "Limite gratuite de l'IA atteinte pour le moment. Patiente une minute et réessaie ; si la limite du jour est atteinte, ça repart demain.",
      429,
    );
  }
  if (m.includes("api key") || m.includes("api_key")) {
    return new UserFacingError("Clé Gemini invalide : vérifie la valeur de CLE_GEMINI (sans espace ni guillemets).", 401);
  }
  if (status === 403) return new UserFacingError("Cette clé Gemini n'a pas accès à l'IA de Google. Vérifie-la dans Google AI Studio.", 403);
  if (status === 404) {
    return new UserFacingError(
      `Le modèle Gemini « ${geminiModel()} » est introuvable. Supprime MODELE_GEMINI pour revenir au modèle par défaut.`,
      404,
    );
  }
  if (status === 400 && (m.includes("location") || m.includes("region") || m.includes("country"))) {
    return new UserFacingError("L'offre gratuite de Gemini n'est pas disponible depuis ce serveur.", 400);
  }
  if (status >= 500) return new UserFacingError("L'IA de Google est momentanément surchargée ou indisponible. Réessaie dans un instant.", 503);
  return new UserFacingError(`L'IA de Google a refusé la requête (${status}) : ${message}`, 502);
}

export function createGeminiClient({ timeoutMs = 120_000, maxRetries = 1 }: GeneratorOptions = {}, fetchImpl: typeof fetch = fetch) {
  return async function call(req: GeminiRequest, tooLong: string): Promise<string> {
    const key = geminiKey();
    if (!key) throw new UserFacingError("Clé Gemini manquante : ajoute la variable CLE_GEMINI.", 500);
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.contents,
      generationConfig: {
        maxOutputTokens: req.maxOutputTokens,
        ...(req.schema ? { responseMimeType: "application/json", responseSchema: req.schema } : {}),
      },
    });

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetchImpl(`${API_URL}/${encodeURIComponent(geminiModel())}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body,
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) {
          throw new UserFacingError("L'IA a mis trop de temps à répondre. Réessaie, ou fais une demande plus courte.", 504);
        }
        if (attempt < maxRetries) continue;
        throw new UserFacingError(`Impossible de joindre l'IA de Google (${err instanceof Error ? err.message : "réseau"}).`, 502);
      } finally {
        clearTimeout(timer);
      }

      const json = (await res.json().catch(() => null)) as {
        error?: { message?: string };
        promptFeedback?: { blockReason?: string };
        candidates?: { finishReason?: string; content?: { parts?: Part[] } }[];
      } | null;

      if (!res.ok) {
        if (res.status >= 500 && attempt < maxRetries) continue;
        throw httpError(res.status, json?.error?.message ?? res.statusText);
      }
      if (json?.promptFeedback?.blockReason) {
        throw new UserFacingError("L'IA a refusé de traiter cette demande. Reformule-la et réessaie.", 422);
      }
      const candidate = json?.candidates?.[0];
      const finish = candidate?.finishReason ?? "";
      if (BLOCKED.has(finish)) throw new UserFacingError("L'IA a refusé de traiter cette demande. Reformule-la et réessaie.", 422);
      const text = (candidate?.content?.parts ?? [])
        .filter((p) => typeof p.text === "string" && !p.thought)
        .map((p) => p.text)
        .join("")
        .trim();
      if (finish === "MAX_TOKENS") {
        if (!text) throw new UserFacingError(tooLong, 502);
        // Un JSON coupé est inutilisable ; un texte coupé reste lisible.
        if (req.schema) {
          try {
            JSON.parse(text);
          } catch {
            throw new UserFacingError(tooLong, 502);
          }
        }
      }
      return text;
    }
  };
}

/** Lit la réponse JSON de Gemini (en retirant d'éventuelles balises ```json). */
export function parseJson(text: string): unknown {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new UserFacingError("L'IA a renvoyé une réponse illisible. Réessaie.", 502);
  }
}

const user = (...parts: Part[]): Content => ({ role: "user", parts });

/** Cartes mentales et outils d'étude avec Gemini. */
export function createGeminiProvider(
  options: GeneratorOptions = {},
  fetchImpl: typeof fetch = fetch,
): { generator: MindMapGenerator; study: StudyAI } {
  const call = createGeminiClient(options, fetchImpl);
  const carteSchema = toGeminiSchema(CarteSchema);
  const schemas = Object.fromEntries(Object.entries(SCHEMAS).map(([k, v]) => [k, toGeminiSchema(v)])) as Record<keyof typeof SCHEMAS, GeminiSchema>;
  const simplifierSchema = toGeminiSchema(SimplifierSchema);

  return {
    generator: {
      async generate(input) {
        const text = await call(
          { system: SYSTEM_PROMPT, contents: [user({ text: buildUserMessage(input) })], schema: carteSchema, maxOutputTokens: 16000 },
          "La réponse de l'IA a été coupée car elle était trop longue. Essaie une demande plus ciblée.",
        );
        return parseJson(text) as AiMap;
      },
    },
    study: {
      async etude(input) {
        const text = await call(
          {
            system: systemPrompt(input.niveau),
            contents: [user({ text: sourceBlock(input) }, { text: etudeInstructions(input) })],
            schema: schemas[input.type],
            // Les modèles Flash peuvent réfléchir avant d'écrire : on laisse de la marge.
            maxOutputTokens: MAX_TOKENS[input.type] * 2,
          },
          "La réponse de l'IA a été coupée car elle était trop longue. Demande moins de questions ou de cartes, ou un cours plus court.",
        );
        return parseJson(text);
      },

      async chat(input) {
        const history = input.historique
          .slice(-12)
          .map((m): Content => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.texte }] }));
        while (history.length && history[0].role !== "user") history.shift();
        const text = await call(
          {
            system: `${systemPrompt(input.niveau)}\n\n${chatContext(input)}`,
            contents: [...history, user({ text: input.question })],
            maxOutputTokens: 6000,
          },
          "La réponse de l'IA a été coupée. Pose une question plus précise.",
        );
        if (!text) throw new UserFacingError("L'IA n'a pas su répondre. Reformule ta question.", 502);
        return text;
      },

      async simplifier(input) {
        const text = await call(
          {
            system: systemPrompt(input.niveau),
            contents: [user({ text: simplifierPrompt(input) })],
            schema: simplifierSchema,
            maxOutputTokens: 4000,
          },
          "L'explication de l'IA a été coupée. Réessaie sur un passage plus court.",
        );
        const explication = (parseJson(text) as { explication?: unknown })?.explication;
        if (typeof explication !== "string" || !explication.trim()) throw new UserFacingError("L'IA a renvoyé une réponse illisible. Réessaie.", 502);
        return explication.trim();
      },

      async lire(input) {
        const text = await call(
          {
            system: LIRE_SYSTEM,
            contents: [user({ inlineData: { mimeType: input.media, data: input.data } }, { text: LIRE_PROMPT })],
            maxOutputTokens: 12000,
          },
          "Ce document contient trop de texte pour être lu en une fois. Envoie-le en plusieurs photos.",
        );
        if (isNoText(text)) throw new UserFacingError("Aucun texte lisible n'a été trouvé dans ce document. Essaie une photo plus nette.", 422);
        return text;
      },
    },
  };
}
