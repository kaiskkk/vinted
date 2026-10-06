// Logique de l'API, indépendante du serveur qui l'héberge :
// utilisée par Express en local (app.ts) et par la fonction Netlify en ligne.
import { createHash, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { sanitizeAiMap, type AiMap } from "../shared/aiMap";
import { MODEL, UserFacingError, type GenerateInput, type MindMapGenerator } from "./claude";

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

const GenerateBody = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("replace"), prompt: Prompt }),
  z.object({ mode: z.literal("append"), prompt: Prompt, carte: CarteInput }),
]);

const ExpandBody = z.object({ carte: CarteInput, nodeId: z.string().min(1) });

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
  hasApiKey: () => boolean;
  /** Code exigé pour utiliser Claude (variable CODE_ACCES) ; aucun contrôle s'il est vide. */
  accessCode?: () => string | undefined;
  log?: (message: string) => void;
}

export function createApi({ generator, hasApiKey, accessCode = () => undefined, log = () => {} }: ApiOptions) {
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
  };
}

export type Api = ReturnType<typeof createApi>;

const MAX_BODY_CHARS = 1_000_000;

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
    if (route !== "/api/generate" && route !== "/api/expand") {
      return reply({ status: 404, body: { erreur: "Route inconnue." } });
    }
    if (req.method !== "POST") return reply({ status: 405, body: { erreur: "Méthode non autorisée." } });

    const text = await req.text();
    if (text.length > MAX_BODY_CHARS) return reply({ status: 413, body: { erreur: "La carte envoyée est trop volumineuse." } });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply({ status: 400, body: { erreur: "Requête invalide (JSON mal formé)." } });
    }
    const code = req.headers.get(ACCESS_CODE_HEADER);
    return reply(route === "/api/generate" ? await api.generate(body, code) : await api.expand(body, code));
  };
}
