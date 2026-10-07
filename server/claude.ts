import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AiMap } from "../shared/aiMap";
import { NIVEAUX, type Niveau } from "../shared/study";

export const MODEL = "claude-sonnet-5-5";

type Effort = "low" | "medium" | "high";
const EFFORTS: Effort[] = ["low", "medium", "high"];

export type GenerateInput =
  | { mode: "replace"; prompt: string; cours?: string; niveau?: Niveau }
  | { mode: "append"; prompt: string; carte: AiMap }
  | { mode: "expand"; carte: AiMap; nodeId: string };

export interface MindMapGenerator {
  /** Renvoie la carte brute produite par Claude (le nettoyage est fait par l'appelant). */
  generate(input: GenerateInput): Promise<AiMap>;
}

/** Erreur destinée à être affichée telle quelle à l'utilisateur. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

const NoeudSchema = z.object({
  id: z.string().describe('Identifiant court et unique, ex. "n1"'),
  texte: z.string().describe("Texte du nœud, 1 à 6 mots"),
  parentId: z.string().nullable().describe("Id du nœud parent, null pour le nœud central"),
  couleur: z.string().describe('Couleur de fond hexadécimale "#RRGGBB"'),
  emoji: z.string().describe('Un seul emoji pertinent, ou "" si aucun ne convient'),
});

export const CarteSchema = z.object({
  titre: z.string().describe("Titre court de la carte"),
  noeuds: z.array(NoeudSchema),
});

export const SYSTEM_PROMPT = `Tu es un expert en cartes mentales. Tu produis des cartes claires, concrètes, utiles et bien équilibrées, que l'utilisateur pourra ensuite retravailler à la main.

Contenu :
- Écris dans la langue de la demande (français par défaut).
- Chaque nœud tient en 1 à 6 mots : pas de phrase, pas de point final.
- Préfère des idées concrètes et spécifiques au sujet plutôt que des généralités ; évite les doublons.

Format de chaque nœud :
- "id" : identifiant court et unique.
- "parentId" : id du nœud parent ; null uniquement pour le nœud central.
- "couleur" : couleur de fond "#RRGGBB". Chaque branche principale a sa propre couleur vive et distincte ; ses sous-idées reprennent cette couleur ou une nuance proche. Le nœud central a une couleur sombre et soutenue.
- "emoji" : un seul emoji pertinent, ou "" si aucun ne convient vraiment.`;

function pathTo(carte: AiMap, nodeId: string): string[] {
  const byId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const path: string[] = [];
  let cur = byId.get(nodeId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur.texte);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** Consigne de vocabulaire selon le niveau scolaire choisi par l'élève. */
export function niveauConsigne(niveau: Niveau | undefined): string {
  if (!niveau) return "";
  const label = NIVEAUX.find((n) => n.value === niveau)?.label ?? niveau;
  return `Niveau de l'élève : ${label}. Adapte le vocabulaire à ce niveau.`;
}

export function buildUserMessage(input: GenerateInput): string {
  if (input.mode === "replace") {
    const cours = input.cours?.trim();
    const niveau = niveauConsigne(input.niveau);
    return `${
      cours
        ? `Voici le cours de l'élève :

<cours>
${cours}
</cours>

Crée une carte mentale complète de ce cours, fidèle à son contenu, pour la demande suivante.`
        : "Crée une carte mentale complète pour la demande suivante."
    }

<demande>
${input.prompt}
</demande>
${niveau ? `\n${niveau}\n` : ""}
Structure attendue : un seul nœud central (parentId null) qui résume le sujet en quelques mots, 4 à 7 branches principales, chacune avec 2 à 5 sous-idées, et un troisième niveau seulement quand il apporte du concret. Entre 20 et 45 nœuds au total. "titre" reprend le texte du nœud central.`;
  }

  const carteJson = JSON.stringify(input.carte);

  if (input.mode === "append") {
    return `Voici une carte mentale existante, au format JSON :

<carte>
${carteJson}
</carte>

Complète-la selon la demande suivante :

<demande>
${input.prompt}
</demande>

Renvoie UNIQUEMENT les nouveaux nœuds, jamais les nœuds existants. Chaque nouveau nœud a pour parentId l'id d'un nœud existant ou celui d'un autre nouveau nœud. Donne aux nouveaux nœuds des ids de la forme "x1", "x2"… N'ajoute pas d'idée déjà présente. Entre 5 et 25 nouveaux nœuds. Pour les couleurs, reprends celle de la branche à laquelle tu rattaches chaque nouveau nœud (une nouvelle branche principale reçoit une nouvelle couleur). "titre" reprend le titre de la carte existante.`;
  }

  const target = input.carte.noeuds.find((n) => n.id === input.nodeId);
  if (!target) throw new UserFacingError("Le nœud à développer est introuvable dans la carte.", 400);
  const children = input.carte.noeuds.filter((n) => n.parentId === target.id).map((n) => n.texte);
  const path = pathTo(input.carte, target.id).join(" › ");

  return `Voici une carte mentale existante, au format JSON :

<carte>
${carteJson}
</carte>

Développe le nœud "${target.texte}" (id "${target.id}", chemin : ${path}) en 3 à 6 sous-idées nouvelles, concrètes et complémentaires${
    children.length ? ` de ses enfants actuels (${children.join(", ")})` : ""
  }.

Renvoie UNIQUEMENT ces nouveaux nœuds, tous avec parentId "${target.id}" et des ids de la forme "x1", "x2"… Reprends la couleur du nœud développé ou une nuance proche. "titre" reprend le titre de la carte existante.`;
}

export function hasCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());
}

export interface GeneratorOptions {
  /** Délai maximum d'un appel à Claude, en millisecondes. */
  timeoutMs?: number;
  /** Nouvelles tentatives automatiques du SDK en cas d'erreur passagère. */
  maxRetries?: number;
}

/** Client Anthropic partagé, créé au premier appel ; erreur claire si la clé manque. */
export function clientFactory({ timeoutMs = 120_000, maxRetries = 2 }: GeneratorOptions = {}) {
  let client: Anthropic | null = null;
  return (): Anthropic => {
    if (!hasCredentials()) {
      throw new UserFacingError(
        "Clé API manquante : ajoute CLE_GEMINI (gratuite, voir le README) ou ANTHROPIC_API_KEY dans le fichier .env (en local) ou dans les variables d'environnement Netlify (en ligne), puis relance ou redéploie.",
        500,
      );
    }
    client ??= new Anthropic({ timeout: timeoutMs, maxRetries });
    return client;
  };
}

/** Niveau de réflexion de Claude (variable CLAUDE_EFFORT), « low » par défaut : plus rapide. */
export function effortFromEnv(): Effort {
  const effortEnv = process.env.CLAUDE_EFFORT as Effort | undefined;
  return effortEnv && EFFORTS.includes(effortEnv) ? effortEnv : "low";
}

/** Transforme les fins de réponse anormales (refus, réponse coupée) en messages clairs. */
export function checkStopReason(stopReason: string | null | undefined, tooLong: string) {
  if (stopReason === "refusal") {
    throw new UserFacingError("Claude a refusé de traiter cette demande. Reformule-la et réessaie.", 422);
  }
  if (stopReason === "max_tokens") {
    throw new UserFacingError(tooLong, 502);
  }
}

export function createClaudeGenerator(options: GeneratorOptions = {}): MindMapGenerator {
  const getClient = clientFactory(options);

  return {
    async generate(input) {
      const client = getClient();
      const effort = effortFromEnv();

      const response = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        // Si le modèle décline pour raison de politique, l'API réessaie côté serveur
        // sur le modèle de repli prévu par Anthropic.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort,
          format: betaZodOutputFormat(CarteSchema),
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(input) }],
      });

      checkStopReason(response.stop_reason, "La réponse de Claude a été coupée car elle était trop longue. Essaie une demande plus ciblée.");
      if (!response.parsed_output) {
        throw new UserFacingError("Claude a renvoyé une réponse illisible. Réessaie.", 502);
      }
      return response.parsed_output;
    },
  };
}
