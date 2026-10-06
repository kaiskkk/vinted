import fs from "node:fs";
import path from "node:path";
import express, { type ErrorRequestHandler, type Response } from "express";
import { ACCESS_CODE_HEADER, createApi, type ApiOptions, type ApiResponse } from "./api";

export interface AppOptions extends ApiOptions {
  /** Dossier du front compilé (`dist`) à servir en production. */
  staticDir?: string;
}

/** Serveur Express utilisé en local (`npm run dev`, `npm start`). */
export function createApp({ staticDir, ...apiOptions }: AppOptions) {
  const api = createApi(apiOptions);
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const send = (res: Response, { status, body }: ApiResponse) => res.status(status).json(body);

  app.get("/api/health", (_req, res) => send(res, api.health()));
  app.post("/api/generate", async (req, res) => send(res, await api.generate(req.body, req.get(ACCESS_CODE_HEADER))));
  app.post("/api/expand", async (req, res) => send(res, await api.expand(req.body, req.get(ACCESS_CODE_HEADER))));

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
