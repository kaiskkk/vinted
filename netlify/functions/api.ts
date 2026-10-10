// Fonction Netlify : sert /api/* une fois le site en ligne.
// La clé API est lue dans les variables d'environnement du site Netlify, jamais dans le front.
import type { Config } from "@netlify/functions";
import { createAI } from "../../server/ai";
import { createApi, createFetchHandler } from "../../server/api";
import { verifierFromEnv } from "../../server/auth";

// Netlify coupe une fonction au bout d'environ 30 s : on s'arrête avant pour renvoyer un message clair.
const limits = { timeoutMs: 25_000, maxRetries: 0 };

// Gemini (gratuit) si la variable CLE_GEMINI existe, sinon Claude.
const api = createApi({
  ...createAI(limits),
  accessCode: () => process.env.CODE_ACCES?.trim() || undefined,
  // Comptes élèves : l'IA n'est utilisable que connecté si VITE_FIREBASE_CONFIG est renseignée.
  verifyUser: verifierFromEnv(),
  log: (message) => console.log(message),
});

export default createFetchHandler(api);

export const config: Config = {
  path: [
    "/api/health",
    "/api/generate",
    "/api/expand",
    "/api/etude",
    "/api/redaction",
    "/api/chat",
    "/api/simplifier",
    "/api/lire",
    "/api/copie",
    "/api/oral",
  ],
};
