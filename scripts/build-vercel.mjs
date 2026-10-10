// Prépare le site pour Vercel (hébergement gratuit, sans crédits), au format « Build Output API » :
//   .vercel/output/static/                     le site compilé (copie de dist/)
//   .vercel/output/functions/api/<route>.func/ une fonction par route de l'API (même code que Netlify)
//   .vercel/output/config.json                 en-têtes de cache, comme dans netlify.toml
// Lancé par `npm run build:vercel`, la commande de build déclarée dans vercel.json.
import { build } from "esbuild";
import fs from "node:fs/promises";

const OUT = ".vercel/output";
// Mêmes routes que netlify/functions/api.ts.
const ROUTES = ["health", "generate", "expand", "etude", "redaction", "chat", "simplifier", "lire", "copie", "oral"];

await fs.rm(OUT, { recursive: true, force: true });
await fs.cp("dist", `${OUT}/static`, { recursive: true });

// Un seul fichier autonome (dépendances comprises), recopié dans chaque fonction.
const bundle = `${OUT}/api.mjs`;
await build({
  entryPoints: ["server/vercel.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: bundle,
  logLevel: "warning",
  // Certaines dépendances utilisent encore require() : on le fournit au module ESM.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
});

for (const route of ROUTES) {
  const dir = `${OUT}/functions/api/${route}.func`;
  await fs.mkdir(dir, { recursive: true });
  await fs.copyFile(bundle, `${dir}/index.mjs`);
  await fs.writeFile(
    `${dir}/.vc-config.json`,
    JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 60 }, null, 2),
  );
}
await fs.rm(bundle);

await fs.writeFile(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Le service worker doit toujours être vérifié pour que les mises à jour arrivent.
        { src: "^/sw\\.js$", headers: { "cache-control": "no-cache" }, continue: true },
        { src: "^/manifest\\.webmanifest$", headers: { "content-type": "application/manifest+json; charset=utf-8" }, continue: true },
        // Lecteur de PDF (pdf.js) : son « worker » est un module JavaScript.
        { src: "^/assets/.+\\.mjs$", headers: { "content-type": "text/javascript; charset=utf-8" }, continue: true },
        // Fichiers versionnés par le build : gardés en cache longtemps.
        { src: "^/assets/", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { handle: "filesystem" },
      ],
    },
    null,
    2,
  ),
);

console.log(`Vercel : site et ${ROUTES.length} fonctions prêts dans ${OUT}`);
