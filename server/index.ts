import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app";
import { createAI, usesGemini } from "./ai";
import { verifierFromEnv } from "./auth";
import { MODEL, hasCredentials } from "./claude";
import { geminiModel } from "./gemini";

dotenv.config({ quiet: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";

const app = createApp({
  ...createAI({ maxRetries: 2 }),
  accessCode: () => process.env.CODE_ACCES?.trim() || undefined,
  // Comptes élèves : actifs si VITE_FIREBASE_CONFIG est renseignée.
  verifyUser: verifierFromEnv(),
  staticDir: production ? path.resolve(here, "../dist") : undefined,
  log: (message) => console.log(message),
});

app.listen(port, () => {
  console.log(`Serveur prêt sur http://localhost:${port} (IA : ${usesGemini() ? `Gemini, ${geminiModel()}` : `Claude, ${MODEL}`})`);
  if (production) console.log(`Application disponible sur http://localhost:${port}`);
  if (!usesGemini() && !hasCredentials()) {
    console.warn("⚠️  Aucune clé d'IA : ajoute CLE_GEMINI (gratuit) ou ANTHROPIC_API_KEY dans .env. Voir .env.example.");
  }
});
