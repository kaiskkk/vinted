// Fonction Netlify : sert /api/* une fois le site en ligne.
// La clé API est lue dans les variables d'environnement du site Netlify, jamais dans le front.
import type { Config } from "@netlify/functions";
import { createApi, createFetchHandler } from "../../server/api";
import { createClaudeGenerator, hasCredentials } from "../../server/claude";

const api = createApi({
  // Netlify coupe une fonction après 60 s : on abandonne avant pour renvoyer un message clair.
  generator: createClaudeGenerator({ timeoutMs: 50_000, maxRetries: 0 }),
  hasApiKey: hasCredentials,
  accessCode: () => process.env.CODE_ACCES?.trim() || undefined,
  log: (message) => console.log(message),
});

export default createFetchHandler(api);

export const config: Config = {
  path: ["/api/health", "/api/generate", "/api/expand"],
};
