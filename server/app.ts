import fs from "node:fs";
import path from "node:path";
import express, { type ErrorRequestHandler, type Response } from "express";
import { ACCESS_CODE_HEADER, LIRE_MAX_CHARS, POST_ROUTES, TOO_LARGE, createApi, type ApiOptions, type ApiResponse } from "./api";

export interface AppOptions extends ApiOptions {
  /** Dossier du front compilé (`dist`) à servir en production. */
  staticDir?: string;
}

/** Serveur Express utilisé en local (`npm run dev`, `npm start`). */
export function createApp({ staticDir, ...apiOptions }: AppOptions) {
  const api = createApi(apiOptions);
  const app = express();
  // Les photos de cours (base64) ont droit à un corps plus gros que le reste.
  app.use("/api/lire", express.json({ limit: LIRE_MAX_CHARS + 10_000 }));
  app.use(express.json({ limit: "1mb" }));

  const send = (res: Response, { status, body }: ApiResponse) => res.status(status).json(body);

  app.get("/api/health", (_req, res) => send(res, api.health()));
  for (const [route, method] of Object.entries(POST_ROUTES)) {
    app.post(route, async (req, res) =>
      send(res, await api[method](req.body, { code: req.get(ACCESS_CODE_HEADER), authorization: req.get("authorization") })),
    );
  }

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
      err?.type === "entity.too.large" ? TOO_LARGE : status === 400 ? "Requête invalide (JSON mal formé)." : "Erreur inattendue du serveur.";
    res.status(status).json({ erreur: message });
  };
  app.use(onError);

  return app;
}
