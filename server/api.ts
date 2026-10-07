// Logique de l'API, indépendante du serveur qui l'héberge :
// utilisée par Express en local (app.ts) et par la fonction Netlify en ligne.
import { createHash, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { sanitizeAiMap, type AiMap } from "../shared/aiMap";
import { SOURCE_MAX, TYPES_ETUDE, isUsable, sanitizeEtude, type TypeEtude } from "../shared/study";
import { MODEL, UserFacingError, type GenerateInput, type MindMapGenerator } from "./claude";
import type { StudyAI } from "./study";

/** Taille maximale d'une photo ou d'une page envoyée en base64 (≈ 3 Mo). */
export const LIRE_MAX_CHARS = 4_000_000;

const CarteInput = z.object({
  titre: z.string().max(300),
  noeuds: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        texte: z.string().max(500),
        parentId: z.string().max(100).nullable(),
        couleur: z.string().max(30).default(""),
        emoji: z.string().max(30).default(""),
      }),
    )
    .min(1)
    .max(500),
});

const Prompt = z
  .string()
  .trim()
  .min(1, "Écris d'abord ce que tu veux dans ta carte mentale.")
  .max(2000, "Ta demande est trop longue (2000 caractères maximum).");

const Niveau = z.enum(["college", "lycee", "superieur"]).optional();
// Un peu de marge au-delà de SOURCE_MAX : le front coupe déjà le cours à cette longueur.
const Cours = z
  .string()
  .max(SOURCE_MAX + 5000, "Ton cours est trop long : garde seulement le chapitre à travailler.")
  .optional();
const Sujet = z.string().trim().max(300, "Le sujet est trop long (300 caractères maximum).").optional();

const GenerateBody = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("replace"), prompt: Prompt, cours: Cours, niveau: Niveau }),
  z.object({ mode: z.literal("append"), prompt: Prompt, carte: CarteInput }),
]);

const ExpandBody = z.object({ carte: CarteInput, nodeId: z.string().min(1) });

const hasSource = (b: { cours?: string; sujet?: string }) => Boolean(b.cours?.trim() || b.sujet?.trim());
const NO_SOURCE = { message: "Ajoute d'abord un cours ou un sujet." };

const EtudeBody = z
  .object({
    type: z.enum(TYPES_ETUDE as [TypeEtude, ...TypeEtude[]]),
    cours: Cours,
    sujet: Sujet,
    niveau: Niveau,
    nombre: z.number().int().min(3).max(30).optional(),
    difficulte: z.enum(["facile", "moyen", "difficile"]).optional(),
    consigne: z.string().max(500, "La précision est trop longue (500 caractères maximum).").optional(),
  })
  .refine(hasSource, NO_SOURCE);

const ChatBody = z
  .object({
    cours: Cours,
    sujet: Sujet,
    niveau: Niveau,
    historique: z
      .array(z.object({ role: z.enum(["user", "assistant"]), texte: z.string().max(8000) }))
      .max(40)
      .default([]),
    question: z.string().trim().min(1, "Écris d'abord ta question.").max(2000, "Ta question est trop longue (2000 caractères maximum)."),
  })
  .refine(hasSource, NO_SOURCE);

const SimplifierBody = z.object({
  texte: z.string().trim().min(1, "Il n'y a rien à expliquer.").max(5000, "Ce passage est trop long à simplifier."),
  contexte: z.string().max(500).optional(),
  niveau: Niveau,
});

const LireBody = z.object({
  media: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"], {
    error: "Format non pris en charge : envoie une photo (JPEG, PNG) ou un PDF.",
  }),
  data: z
    .string()
    .min(1)
    .max(LIRE_MAX_CHARS, "Fichier trop lourd : envoie une photo plus légère.")
    .regex(/^[A-Za-z0-9+/=\s]+$/, "Fichier illisible."),
});

/** Plafond des réponses par type, au cas où Claude en ferait trop. */
function limitCount(type: TypeEtude, doc: ReturnType<typeof sanitizeEtude>, nombre?: number) {
  if (!nombre) return doc;
  if (type === "quiz" && "questions" in doc) return { ...doc, questions: doc.questions.slice(0, nombre) };
  if (type === "flashcards" && "cartes" in doc) return { ...doc, cartes: doc.cartes.slice(0, nombre) };
  return doc;
}

/** En-tête HTTP qui transporte le code d'accès du site. */
export const ACCESS_CODE_HEADER = "x-code-acces";

export interface ApiResponse {
  status: number;
  body: unknown;
}

function rootOf(carte: AiMap): string {
  return (carte.noeuds.find((n) => n.parentId === null) ?? carte.noeuds[0]).id;
}

/** Traduit les erreurs de l'API Anthropic en messages compréhensibles. */
export function toUserError(err: unknown): UserFacingError {
  if (err instanceof UserFacingError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new UserFacingError("Clé API invalide : vérifie la valeur de ANTHROPIC_API_KEY.", 401);
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new UserFacingError("Ta clé API n'a pas accès à ce modèle Claude.", 403);
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new UserFacingError(`Le modèle ${MODEL} est introuvable pour cette clé API.`, 404);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new UserFacingError("Trop de demandes envoyées à Claude. Patiente quelques secondes et réessaie.", 429);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new UserFacingError(`L'API Claude a refusé la requête : ${err.message}`, 400);
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new UserFacingError("Claude a mis trop de temps à répondre. Réessaie, ou fais une demande plus courte.", 504);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new UserFacingError("Impossible de joindre l'API Claude. Vérifie ta connexion internet.", 502);
  }
  if (err instanceof Anthropic.InternalServerError) {
    return new UserFacingError("Claude est momentanément surchargé ou indisponible. Réessaie dans un instant.", 503);
  }
  if (err instanceof Anthropic.APIError) {
    return new UserFacingError(`Erreur de l'API Claude (${err.status ?? "?"}) : ${err.message}`, 502);
  }
  const message = err instanceof Error ? err.message : String(err);
  return new UserFacingError(`Erreur inattendue du serveur : ${message}`, 500);
}

function badRequest(error: z.ZodError): ApiResponse {
  const first = error.issues[0];
  const message = first?.message && !first.message.startsWith("Invalid") ? first.message : "Requête invalide.";
  return { status: 400, body: { erreur: message } };
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export interface ApiOptions {
  generator: MindMapGenerator;
  /** Outils d'étude (fiches, quiz…) ; absents, leurs routes répondent 503. */
  study?: StudyAI;
  hasApiKey: () => boolean;
  /** Code exigé pour utiliser Claude (variable CODE_ACCES) ; aucun contrôle s'il est vide. */
  accessCode?: () => string | undefined;
  log?: (message: string) => void;
}

export function createApi({ generator, study, hasApiKey, accessCode = () => undefined, log = () => {} }: ApiOptions) {
  /** Renvoie une réponse d'erreur si le code d'accès est absent ou faux, sinon null. */
  function checkAccess(provided: string | undefined | null): ApiResponse | null {
    const expected = accessCode();
    if (!expected) return null;
    if (!provided) {
      return { status: 401, body: { erreur: "Ce site est protégé : entre le code d'accès pour utiliser Claude.", code: "CODE_REQUIS" } };
    }
    if (!timingSafeEqual(digest(provided), digest(expected))) {
      return { status: 401, body: { erreur: "Code d'accès incorrect.", code: "CODE_INVALIDE" } };
    }
    return null;
  }

  async function run(input: GenerateInput): Promise<ApiResponse> {
    const started = Date.now();
    try {
      const raw = await generator.generate(input);
      let result: AiMap;
      if (input.mode === "replace") {
        result = sanitizeAiMap(raw);
      } else {
        result = sanitizeAiMap(raw, {
          existingIds: input.carte.noeuds.map((n) => n.id),
          fallbackParentId: rootOf(input.carte),
          onlyUnder: input.mode === "expand" ? input.nodeId : undefined,
          maxNodes: input.mode === "expand" ? 12 : 80,
        });
      }
      if (result.noeuds.length === 0) {
        throw new UserFacingError("Claude n'a proposé aucune idée exploitable. Reformule ta demande.", 502);
      }
      log(`[claude] ${input.mode} : ${result.noeuds.length} nœuds en ${Date.now() - started} ms`);
      return { status: 200, body: result };
    } catch (err) {
      const userError = toUserError(err);
      log(`[claude] ${input.mode} : échec (${userError.status}) ${userError.message}`);
      return { status: userError.status, body: { erreur: userError.message } };
    }
  }

  /** Appel générique : contrôle d'accès, validation de la requête, appel à Claude, erreurs lisibles. */
  async function handle<T>(
    name: string,
    body: unknown,
    code: string | undefined | null,
    schema: z.ZodType<T>,
    work: (input: T, ai: StudyAI) => Promise<unknown>,
  ): Promise<ApiResponse> {
    const denied = checkAccess(code);
    if (denied) return denied;
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    if (!study) return { status: 503, body: { erreur: "Cette fonction n'est pas disponible sur ce serveur." } };
    const started = Date.now();
    try {
      const result = await work(parsed.data, study);
      log(`[claude] ${name} : réussi en ${Date.now() - started} ms`);
      return { status: 200, body: result };
    } catch (err) {
      const userError = toUserError(err);
      log(`[claude] ${name} : échec (${userError.status}) ${userError.message}`);
      return { status: userError.status, body: { erreur: userError.message } };
    }
  }

  return {
    health(): ApiResponse {
      return { status: 200, body: { ok: true, modele: MODEL, cleApi: hasApiKey(), codeRequis: Boolean(accessCode()) } };
    },

    async generate(body: unknown, code?: string | null): Promise<ApiResponse> {
      const denied = checkAccess(code);
      if (denied) return denied;
      const parsed = GenerateBody.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error);
      return run(parsed.data);
    },

    async expand(body: unknown, code?: string | null): Promise<ApiResponse> {
      const denied = checkAccess(code);
      if (denied) return denied;
      const parsed = ExpandBody.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error);
      const { carte, nodeId } = parsed.data;
      if (!carte.noeuds.some((n) => n.id === nodeId)) {
        return { status: 400, body: { erreur: "Le nœud à développer est introuvable dans la carte." } };
      }
      return run({ mode: "expand", carte, nodeId });
    },

    etude: (body: unknown, code?: string | null) =>
      handle(`étude ${(body as { type?: string })?.type ?? "?"}`, body, code, EtudeBody, async (input, ai) => {
        const raw = await ai.etude(input);
        const doc = limitCount(input.type, sanitizeEtude(input.type, raw), input.nombre);
        if (!isUsable(input.type, doc)) {
          throw new UserFacingError("Claude n'a rien produit d'exploitable. Réessaie, ou ajoute plus de contenu au cours.", 502);
        }
        return doc;
      }),

    chat: (body: unknown, code?: string | null) => handle("question", body, code, ChatBody, async (input, ai) => ({ reponse: await ai.chat(input) })),

    simplifier: (body: unknown, code?: string | null) =>
      handle("simplifier", body, code, SimplifierBody, async (input, ai) => ({ explication: await ai.simplifier(input) })),

    lire: (body: unknown, code?: string | null) =>
      handle("lecture", body, code, LireBody, async (input, ai) => ({
        texte: (await ai.lire({ media: input.media, data: input.data.replace(/\s+/g, "") })).slice(0, SOURCE_MAX),
      })),
  };
}

/** Routes POST de l'API et méthode correspondante. */
export const POST_ROUTES = {
  "/api/generate": "generate",
  "/api/expand": "expand",
  "/api/etude": "etude",
  "/api/chat": "chat",
  "/api/simplifier": "simplifier",
  "/api/lire": "lire",
} as const satisfies Record<string, keyof Api>;

export type Api = ReturnType<typeof createApi>;

export const TOO_LARGE = "Les données envoyées sont trop volumineuses.";

const MAX_BODY_CHARS = 1_000_000;
// Une photo de cours en base64 pèse plus lourd que le reste.
const bodyLimit = (route: string) => (route === "/api/lire" ? LIRE_MAX_CHARS + 10_000 : MAX_BODY_CHARS);

/** Gestionnaire HTTP au format web standard (Request → Response), utilisé par Netlify. */
export function createFetchHandler(api: Api) {
  const reply = ({ status, body }: ApiResponse) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });

  return async (req: Request): Promise<Response> => {
    const route = new URL(req.url).pathname.replace(/\/+$/, "");
    if (route === "/api/health") return reply(api.health());
    const method = POST_ROUTES[route as keyof typeof POST_ROUTES];
    if (!method) return reply({ status: 404, body: { erreur: "Route inconnue." } });
    if (req.method !== "POST") return reply({ status: 405, body: { erreur: "Méthode non autorisée." } });

    const text = await req.text();
    if (text.length > bodyLimit(route)) return reply({ status: 413, body: { erreur: TOO_LARGE } });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply({ status: 400, body: { erreur: "Requête invalide (JSON mal formé)." } });
    }
    return reply(await api[method](body, req.headers.get(ACCESS_CODE_HEADER)));
  };
}
