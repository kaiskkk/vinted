import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app";
import { MODEL, createClaudeGenerator, hasCredentials } from "./claude";

dotenv.config({ quiet: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3001;
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";

const app = createApp({
  generator: createClaudeGenerator(),
  hasApiKey: hasCredentials,
  staticDir: production ? path.resolve(here, "../dist") : undefined,
  log: (message) => console.log(message),
});

app.listen(port, () => {
  console.log(`Serveur prêt sur http://localhost:${port} (modèle ${MODEL})`);
  if (production) console.log(`Application disponible sur http://localhost:${port}`);
  if (!hasCredentials()) {
    console.warn("⚠️  ANTHROPIC_API_KEY absente : la génération avec Claude ne fonctionnera pas. Voir .env.example.");
  }
});
