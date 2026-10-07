import type { AiMap } from "../../shared/aiMap";
import type { Difficulte, FicheIA, FlashcardsIA, Niveau, QuizIA, ResumeIA, RevisionIA, TypeEtude } from "../../shared/study";

const CODE_KEY = "mm-code-acces";

/** Erreur d'appel au serveur ; `retryable` indique si réessayer a des chances de marcher. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
  }
}

// Surcharge passagère, délai dépassé, limite de débit : réessayer peut suffire.
const RETRYABLE = new Set([408, 429, 502, 503, 504]);

export interface Health {
  ok: boolean;
  modele: string;
  cleApi: boolean;
  codeRequis?: boolean;
}

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
    throw new ApiError("Impossible de contacter le serveur. Vérifie ta connexion internet.", 0, true);
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
    if (entered === null) throw new ApiError("Code d'accès requis pour utiliser Claude.", 401, false);
    storeCode(entered.trim());
    return post<T>(url, body, signal, attempt + 1);
  }

  if (!res.ok || !json) {
    if (json?.erreur) throw new ApiError(json.erreur, res.status, RETRYABLE.has(res.status));
    if (res.status >= 500) {
      throw new ApiError("Le serveur n'a pas répondu à temps. Réessaie dans un instant.", res.status, true);
    }
    throw new ApiError(`Réponse inattendue du serveur (${res.status}).`, res.status, false);
  }
  return json as T;
}

export const generateMap = (prompt: string, signal?: AbortSignal) => post<AiMap>("/api/generate", { mode: "replace", prompt }, signal);

/** Carte mentale construite à partir d'un cours (mode Général). */
export const generateMapFromCourse = (prompt: string, cours: string, niveau: Niveau, signal?: AbortSignal) =>
  post<AiMap>("/api/generate", { mode: "replace", prompt, cours: cours || undefined, niveau }, signal);

export interface SourceEtude {
  cours?: string;
  sujet?: string;
}

export interface EtudeOptions {
  nombre?: number;
  difficulte?: Difficulte;
  consigne?: string;
}

interface EtudeResults {
  fiche: FicheIA;
  revision: RevisionIA;
  quiz: QuizIA;
  flashcards: FlashcardsIA;
  resume: ResumeIA;
}

export const generateEtude = <T extends TypeEtude>(type: T, source: SourceEtude, niveau: Niveau, options: EtudeOptions = {}, signal?: AbortSignal) =>
  post<EtudeResults[T]>("/api/etude", { type, ...source, niveau, ...options }, signal);

export const askCourse = (
  source: SourceEtude,
  niveau: Niveau,
  historique: { role: "user" | "assistant"; texte: string }[],
  question: string,
  signal?: AbortSignal,
) => post<{ reponse: string }>("/api/chat", { ...source, niveau, historique, question }, signal);

export const simplify = (texte: string, niveau: Niveau, contexte?: string, signal?: AbortSignal) =>
  post<{ explication: string }>("/api/simplifier", { texte, niveau, contexte }, signal);

export const readWithClaude = (media: string, data: string, signal?: AbortSignal) => post<{ texte: string }>("/api/lire", { media, data }, signal);

export const appendToMap = (prompt: string, carte: AiMap, signal?: AbortSignal) =>
  post<AiMap>("/api/generate", { mode: "append", prompt, carte }, signal);

export const expandNode = (carte: AiMap, nodeId: string) => post<AiMap>("/api/expand", { carte, nodeId });

export async function getHealth(): Promise<Health | null> {
  try {
    const res = await fetch("/api/health");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
