import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import handler from "./vercel";

// Le lanceur Node de Vercel appelle la fonction avec (req, res), comme un serveur http classique.
const server = http.createServer((req, res) => void handler(req, res));
let base = "";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const post = (path: string, body: string) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body });

describe("fonction Vercel", () => {
  it("sert la même API que Netlify", async () => {
    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true });

    const vide = await post("/api/generate", JSON.stringify({ mode: "replace", prompt: " " }));
    expect(vide.status).toBe(400);
    expect(((await vide.json()) as { erreur: string }).erreur).toMatch(/Écris d'abord/);

    expect((await post("/api/etude", "{oups")).status).toBe(400);
    expect((await fetch(`${base}/api/generate`)).status).toBe(405);
    expect((await post("/api/inconnue", "{}")).status).toBe(404);
  });

  it("refuse un corps trop gros sans le lire en entier", async () => {
    const res = await post("/api/lire", "x".repeat(9_000_000));
    expect(res.status).toBe(413);
    expect(((await res.json()) as { erreur: string }).erreur).toMatch(/trop volumineuses/);
  });
});
