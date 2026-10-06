import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
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

function rootOf(carte: AiMap): string {
  return (carte.noeuds.find((n) => n.parentId === null) ?? carte.noeuds[0]).id;
}

/** Traduit les erreurs de l'API Anthropic en messages compréhensibles. */
export function toUserError(err: unknown): UserFacingError {
  if (err instanceof UserFacingError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new UserFacingError("Clé API invalide : vérifie ANTHROPIC_API_KEY dans le fichier .env.", 401);
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
    return new UserFacingError("Claude a mis trop de temps à répondre. Réessaie.", 504);
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

function badRequest(res: Response, error: z.ZodError) {
  const first = error.issues[0];
  const message = first?.message && !first.message.startsWith("Invalid") ? first.message : "Requête invalide.";
  res.status(400).json({ erreur: message });
}

export interface AppOptions {
  generator: MindMapGenerator;
  hasApiKey: () => boolean;
  /** Dossier du front compilé (`dist`) à servir en production. */
  staticDir?: string;
  log?: (message: string) => void;
}

export function createApp({ generator, hasApiKey, staticDir, log = () => {} }: AppOptions) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, modele: MODEL, cleApi: hasApiKey() });
  });

  async function run(res: Response, input: GenerateInput) {
    const started = Date.now();
    try {
      const raw = await generator.generate(input);
      let result: AiMap;
      if (input.mode === "replace") {
        result = sanitizeAiMap(raw);
      } else {
        const existingIds = input.carte.noeuds.map((n) => n.id);
        result = sanitizeAiMap(raw, {
          existingIds,
          fallbackParentId: rootOf(input.carte),
          onlyUnder: input.mode === "expand" ? input.nodeId : undefined,
          maxNodes: input.mode === "expand" ? 12 : 80,
        });
      }
      if (result.noeuds.length === 0) {
        throw new UserFacingError("Claude n'a proposé aucune idée exploitable. Reformule ta demande.", 502);
      }
      log(`[claude] ${input.mode} : ${result.noeuds.length} nœuds en ${Date.now() - started} ms`);
      res.json(result);
    } catch (err) {
      const userError = toUserError(err);
      log(`[claude] ${input.mode} : échec (${userError.status}) ${userError.message}`);
      res.status(userError.status).json({ erreur: userError.message });
    }
  }

  app.post("/api/generate", async (req: Request, res: Response) => {
    const parsed = GenerateBody.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    await run(res, parsed.data);
  });

  app.post("/api/expand", async (req: Request, res: Response) => {
    const parsed = ExpandBody.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    const { carte, nodeId } = parsed.data;
    if (!carte.noeuds.some((n) => n.id === nodeId)) {
      return res.status(400).json({ erreur: "Le nœud à développer est introuvable dans la carte." });
    }
    await run(res, { mode: "expand", carte, nodeId });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ erreur: "Route inconnue." });
  });

  if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
    app.use(express.static(staticDir));
    app.use((_req, res) => res.sendFile(path.join(staticDir, "index.html")));
  }

  // JSON mal formé, corps trop gros, etc.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message =
      err?.type === "entity.too.large"
        ? "La carte envoyée est trop volumineuse."
        : status === 400
          ? "Requête invalide (JSON mal formé)."
          : "Erreur inattendue du serveur.";
    res.status(status).json({ erreur: message });
  };
  app.use(onError);

  return app;
}
