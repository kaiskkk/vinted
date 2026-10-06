import type { AiMap } from "../../shared/aiMap";

const CODE_KEY = "mm-code-acces";

type AskCode = (wrong: boolean) => Promise<string | null>;
let askCode: AskCode | null = null;

/** Branche la fenêtre qui demande le code d'accès quand le serveur l'exige. */
export function setAccessCodePrompt(fn: AskCode | null) {
  askCode = fn;
}

function storedCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeCode(code: string) {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {
    // Stockage indisponible : le code sera redemandé la prochaine fois.
  }
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal, attempt = 0): Promise<T> {
  const code = storedCode();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(code ? { "X-Code-Acces": code } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Impossible de contacter le serveur. Vérifie ta connexion (en local : « npm run dev » doit tourner).");
  }

  let json: { erreur?: string; code?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    // Réponse non JSON : serveur arrêté (proxy Vite) ou fonction en ligne coupée pour dépassement de délai.
  }

  // Site protégé par un code d'accès : on le demande, puis on réessaie.
  if (res.status === 401 && (json?.code === "CODE_REQUIS" || json?.code === "CODE_INVALIDE") && askCode && attempt < 3) {
    const entered = await askCode(json.code === "CODE_INVALIDE");
    if (entered === null) throw new Error("Code d'accès requis pour utiliser Claude.");
    storeCode(entered.trim());
    return post<T>(url, body, signal, attempt + 1);
  }

  if (!res.ok || !json) {
    if (json?.erreur) throw new Error(json.erreur);
    if (res.status >= 500) {
      throw new Error("Le serveur n'a pas répondu à temps ou est arrêté. Réessaie (en local : vérifie que « npm run dev » tourne).");
    }
    throw new Error(`Réponse inattendue du serveur (${res.status}).`);
  }
  return json as T;
}

export const generateMap = (prompt: string, signal?: AbortSignal) =>
  post<AiMap>("/api/generate", { mode: "replace", prompt }, signal);

export const appendToMap = (prompt: string, carte: AiMap, signal?: AbortSignal) =>
  post<AiMap>("/api/generate", { mode: "append", prompt, carte }, signal);

export const expandNode = (carte: AiMap, nodeId: string) => post<AiMap>("/api/expand", { carte, nodeId });

export async function getHealth(): Promise<{ ok: boolean; modele: string; cleApi: boolean; codeRequis?: boolean } | null> {
  try {
    const res = await fetch("/api/health");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
