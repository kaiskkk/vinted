// Fonction Vercel : la même API que la fonction Netlify, pour un hébergement gratuit sans crédits.
// `npm run build:vercel` l'assemble en un seul fichier par route (dossier .vercel/output, voir scripts/build-vercel.mjs).
// Les clés d'IA sont lues dans les variables d'environnement du projet Vercel, jamais dans le front.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createAI } from "./ai";
import { LIRE_MAX_CHARS, TOO_LARGE, createApi, createFetchHandler } from "./api";
import { verifierFromEnv } from "./auth";

// Vercel laisse jusqu'à 60 s à une fonction (offre gratuite) : on s'arrête un peu avant pour renvoyer un message clair.
// Avec ce temps, les modèles surchargés sont réessayés jusqu'à deux fois après une courte pause.
const limits = { timeoutMs: 55_000, maxRetries: 2 };

const handle = createFetchHandler(
  createApi({
    ...createAI(limits),
    accessCode: () => process.env.CODE_ACCES?.trim() || undefined,
    // Comptes élèves : l'IA n'est utilisable que connecté si VITE_FIREBASE_CONFIG est renseignée.
    verifyUser: verifierFromEnv(),
    log: (message) => console.log(message),
  }),
);

/** Au-delà, la requête est refusée sans tout lire (une photo de cours est la plus grosse demande). */
const MAX_BODY_BYTES = LIRE_MAX_CHARS * 2;

class TooLarge extends Error {}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new TooLarge();
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

/** Requête Node (Vercel) → requête web standard, comprise par le gestionnaire commun. */
export async function toRequest(req: IncomingMessage): Promise<Request> {
  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "localhost"}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const method = req.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : new Uint8Array(await readBody(req));
  return new Request(url, { method, headers, body });
}

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  let response: Response;
  try {
    response = await handle(await toRequest(req));
  } catch (err) {
    const status = err instanceof TooLarge ? 413 : 500;
    response = new Response(JSON.stringify({ erreur: status === 413 ? TOO_LARGE : "Erreur inattendue du serveur." }), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  // Corps refusé sans être lu en entier : la connexion ne peut pas resservir.
  if (response.status === 413) res.setHeader("connection", "close");
  res.end(Buffer.from(await response.arrayBuffer()));
}
