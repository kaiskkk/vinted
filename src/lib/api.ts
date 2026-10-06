import type { AiMap } from "../../shared/aiMap";

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Impossible de contacter le serveur local. Vérifie qu'il tourne (npm run dev).");
  }

  let json: { erreur?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    // Réponse non JSON : typiquement le proxy Vite quand le serveur Express est arrêté.
  }
  if (!res.ok || !json) {
    if (json?.erreur) throw new Error(json.erreur);
    if (res.status >= 500) throw new Error("Le serveur local ne répond pas. Vérifie qu'il tourne (npm run dev).");
    throw new Error(`Réponse inattendue du serveur (${res.status}).`);
  }
  return json as T;
}

export const generateMap = (prompt: string, signal?: AbortSignal) =>
  post<AiMap>("/api/generate", { mode: "replace", prompt }, signal);

export const appendToMap = (prompt: string, carte: AiMap, signal?: AbortSignal) =>
  post<AiMap>("/api/generate", { mode: "append", prompt, carte }, signal);

export const expandNode = (carte: AiMap, nodeId: string) => post<AiMap>("/api/expand", { carte, nodeId });

export async function getHealth(): Promise<{ ok: boolean; modele: string; cleApi: boolean } | null> {
  try {
    const res = await fetch("/api/health");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
