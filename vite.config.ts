import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

function listFiles(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join("/")];
  });
}

/**
 * Génère /sw.js au build : liste de tous les fichiers du site à garder pour le mode
 * hors connexion, et une version qui change à chaque modification (mise à jour automatique).
 */
function serviceWorker(): Plugin {
  return {
    name: "ecoleduc-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const publicDir = path.join(root, "public");
      const publicFiles = listFiles(publicDir);
      const files = [
        "/",
        ...Object.keys(bundle)
          // Le lecteur de PDF (lourd) et l'ancien format de police ne sont téléchargés qu'au besoin.
          .filter((f) => f !== "index.html" && !f.endsWith(".map") && !f.endsWith(".woff") && !/^assets\/pdf[-.]/.test(f))
          .map((f) => `/${f}`),
        ...publicFiles.map((f) => `/${f}`),
      ];
      const hash = createHash("sha256").update(files.join("\n"));
      for (const f of publicFiles) hash.update(fs.readFileSync(path.join(publicDir, f)));
      const html = bundle["index.html"];
      if (html && html.type === "asset") hash.update(String(html.source));
      const template = fs.readFileSync(path.join(root, "pwa/sw.js"), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template.replace("__VERSION__", hash.digest("hex").slice(0, 12)).replace("__PRECACHE__", JSON.stringify(files)),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  server: {
    port: 5173,
    // Le front appelle /api/... ; Vite relaie vers le serveur Express,
    // qui est le seul à connaître la clé API.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
