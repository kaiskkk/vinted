// Appels à Claude pour les outils d'étude : fiches, révision, quiz, flashcards, résumé,
// questions sur le cours, explications simplifiées et lecture de photos ou de PDF scannés.
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BLOC_TYPES, type Difficulte, type Niveau, type TypeEtude } from "../shared/study";
import { MODEL, UserFacingError, checkStopReason, clientFactory, effortFromEnv, type GeneratorOptions } from "./claude";

export interface Source {
  /** Texte du cours (collé, ou extrait d'un fichier). */
  cours?: string;
  /** Sujet libre quand il n'y a pas de cours. */
  sujet?: string;
}

export interface EtudeInput extends Source {
  type: TypeEtude;
  niveau?: Niveau;
  /** Nombre de questions (quiz) ou de cartes (flashcards). */
  nombre?: number;
  difficulte?: Difficulte;
  /** Précision libre de l'élève (« insiste sur les dates »…). */
  consigne?: string;
}

export interface ChatInput extends Source {
  niveau?: Niveau;
  historique: { role: "user" | "assistant"; texte: string }[];
  question: string;
}

export interface SimplifierInput {
  texte: string;
  contexte?: string;
  niveau?: Niveau;
}

export type MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";
export interface LireInput {
  media: MediaType;
  /** Contenu du fichier en base64. */
  data: string;
}

export interface StudyAI {
  /** Renvoie le document brut produit par Claude (le nettoyage est fait par l'appelant). */
  etude(input: EtudeInput): Promise<unknown>;
  chat(input: ChatInput): Promise<string>;
  simplifier(input: SimplifierInput): Promise<string>;
  lire(input: LireInput): Promise<string>;
}

// ---------- Schémas de sortie (JSON structuré) ----------

const FicheSchema = z.object({
  titre: z.string().describe("Titre de la fiche"),
  sousTitre: z.string().describe('Matière et chapitre, ex. "Histoire — La Révolution française", ou ""'),
  blocs: z.array(
    z.object({
      // Texte libre plutôt qu'une énumération : une variante (« Définition ») est corrigée au nettoyage.
      type: z.string().describe(`Type du bloc, l'un de : ${BLOC_TYPES.map((t) => `"${t}"`).join(", ")}`),
      titre: z.string().describe("Titre court du bloc (le terme défini, la date, le nom de la formule…)"),
      contenu: z.string().describe("Contenu du bloc"),
    }),
  ),
});

const RevisionSchema = z.object({
  titre: z.string(),
  essentiel: z.array(z.object({ titre: z.string(), points: z.array(z.string()) })),
  top10: z.array(z.object({ texte: z.string(), detail: z.string() })),
  pieges: z.array(z.string()),
});

const QuizSchema = z.object({
  titre: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      choix: z.array(z.string()).describe("Exactement 4 réponses possibles"),
      bonneReponse: z.number().describe("Position de la bonne réponse dans choix, de 0 à 3"),
      explication: z.string(),
    }),
  ),
});

const FlashcardsSchema = z.object({
  titre: z.string(),
  cartes: z.array(z.object({ recto: z.string(), verso: z.string() })),
});

const ResumeSchema = z.object({
  titre: z.string(),
  introduction: z.string(),
  sections: z.array(z.object({ titre: z.string(), texte: z.string() })),
  conclusion: z.string(),
});

export const SimplifierSchema = z.object({ explication: z.string() });

export const SCHEMAS = {
  fiche: FicheSchema,
  revision: RevisionSchema,
  quiz: QuizSchema,
  flashcards: FlashcardsSchema,
  resume: ResumeSchema,
} as const;

// ---------- Consignes ----------

const NIVEAU_STYLE: Record<Niveau, string> = {
  college: "L'élève est au collège (11-15 ans) : phrases courtes, mots simples, chaque terme technique est expliqué avec des mots du quotidien.",
  lycee: "L'élève est au lycée : vocabulaire scolaire précis, définitions rigoureuses mais accessibles.",
  superieur: "L'élève fait des études supérieures : vocabulaire technique et rigoureux, nuances et précisions attendues.",
};

export function systemPrompt(niveau: Niveau | undefined): string {
  return `Tu es un professeur particulier expert, exact et bienveillant. Tu aides un élève à comprendre, apprendre et réviser ses cours.

${NIVEAU_STYLE[niveau ?? "lycee"]}

Règles :
- Écris en français.
- Appuie-toi d'abord sur le cours fourni. Tu peux le compléter avec des connaissances sûres et classiques, mais n'invente jamais de fait, de date ou de chiffre.
- Sois rigoureusement exact : définitions, dates, formules et noms doivent être justes.
- Mise en forme autorisée dans les textes : **gras** pour les mots clés, ==surligné== pour l'essentiel, et des lignes qui commencent par "- " pour les listes. Aucun autre Markdown (pas de titres #, pas de tableaux, pas de LaTeX).
- Formules en texte lisible, par exemple "v = d / t" ou "E = m × c²".`;
}

/** Bloc qui contient le cours (ou le sujet) : identique d'un appel à l'autre, donc mis en cache. */
export function sourceBlock({ cours, sujet }: Source): string {
  const c = cours?.trim();
  if (c) {
    return `Voici le cours de l'élève${sujet?.trim() ? ` (sujet : ${sujet.trim()})` : ""} :

<cours>
${c}
</cours>`;
  }
  return `L'élève n'a pas fourni de cours, seulement ce sujet :

<sujet>
${sujet?.trim() ?? ""}
</sujet>

Utilise tes connaissances sûres sur ce sujet, telles qu'on l'enseigne au niveau de l'élève.`;
}

const DIFFICULTE_CONSIGNE: Record<Difficulte, string> = {
  facile: "facile : questions directes de connaissance du cours (définitions, dates, faits essentiels)",
  moyen: "moyenne : questions de compréhension et d'application, pas seulement de mémoire",
  difficile: "difficile : questions d'analyse, cas particuliers, pièges classiques et distracteurs très proches",
};

export function etudeInstructions(input: EtudeInput): string {
  const consigne = input.consigne?.trim() ? `\n\nPrécision de l'élève : ${input.consigne.trim()}` : "";
  switch (input.type) {
    case "fiche":
      return `Crée une fiche de cours claire et structurée.

Utilise les types de blocs dans cet ordre logique :
- "notion" : les 2 à 4 notions clés du chapitre (titre = la notion, contenu = 1 à 3 phrases).
- "definition" : une par définition importante (titre = le terme exact, contenu = la définition).
- "date" : seulement si le cours contient des dates (titre = la date, contenu = l'événement en une phrase).
- "formule" : seulement si le cours contient des formules (titre = son nom, contenu = la formule puis la signification de chaque lettre en liste).
- "exemple" : 1 à 3 exemples concrets qui éclairent le cours.
- "piege" : 1 à 3 erreurs fréquentes ou confusions à éviter.
- "retenir" : un seul bloc final « À retenir » avec 3 à 6 points essentiels en liste.

Entre 8 et 20 blocs au total. Chaque contenu est court : 1 à 4 phrases ou une petite liste. "sousTitre" indique la matière et le chapitre.${consigne}`;
    case "revision":
      return `Crée une fiche de révision ultra-condensée qui tient sur UNE page.

- "essentiel" : 3 à 6 rubriques, chacune avec 2 à 5 points très courts (15 mots maximum chacun), en style télégraphique.
- "top10" : exactement les 10 choses à savoir absolument pour l'examen, de la plus importante à la moins importante. "texte" : 20 mots maximum. "detail" : un complément utile de 25 mots maximum, ou "".
- "pieges" : 2 à 5 pièges ou confusions classiques, une phrase courte chacun.${consigne}`;
    case "quiz": {
      const n = input.nombre ?? 10;
      return `Crée un QCM de ${n} questions, de difficulté ${DIFFICULTE_CONSIGNE[input.difficulte ?? "moyen"]}.

- Chaque question a exactement 4 choix et UNE seule bonne réponse ; "bonneReponse" est sa position (0 à 3).
- Les mauvaises réponses sont plausibles. Pas de « toutes les réponses » ni d'« aucune réponse ».
- Fais varier la position de la bonne réponse d'une question à l'autre.
- "explication" : 1 à 2 phrases qui disent pourquoi la bonne réponse est juste (et, si utile, pourquoi le piège principal est faux).
- Couvre l'ensemble du cours, sans question en double.${consigne}`;
    }
    case "flashcards": {
      const n = input.nombre ?? 15;
      return `Crée ${n} flashcards pour mémoriser ce cours.

- "recto" : une question courte, un terme ou une date (15 mots maximum).
- "verso" : la réponse exacte et courte (40 mots maximum).
- Couvre les notions, définitions, dates et formules importantes, sans doublon.${consigne}`;
    }
    case "resume":
      return `Rédige un résumé clair et fidèle de ce cours.

- "introduction" : 2 à 3 phrases qui présentent le sujet.
- "sections" : 3 à 7 parties dans l'ordre du cours, chacune avec un titre court et un texte de 3 à 6 phrases.
- "conclusion" : 1 à 3 phrases qui dégagent l'idée principale.${consigne}`;
  }
}

/** Contexte de la discussion : le cours, puis la façon de répondre. */
export function chatContext(input: Source): string {
  return `${sourceBlock(input)}

Tu réponds aux questions de l'élève sur ce cours. Réponds de façon claire et directe, en quelques phrases ou une courte liste. Si la question sort du cours, dis-le en une phrase puis réponds quand même si tu le peux. Si l'élève demande un exercice ou un quiz, propose-le et donne la correction à part.`;
}

export function simplifierPrompt(input: SimplifierInput): string {
  return `L'élève n'a pas compris ce passage${input.contexte?.trim() ? ` (extrait de : ${input.contexte.trim()})` : ""} :

<passage>
${input.texte}
</passage>

Explique-le beaucoup plus simplement, comme à un ami : des mots de tous les jours, une image ou un exemple concret de la vie courante, 3 à 6 phrases au total. Garde les informations exactes.`;
}

export const LIRE_SYSTEM = "Tu transcris fidèlement des documents de cours en texte brut.";
export const LIRE_PROMPT = `Transcris tout le texte de ce document de cours, dans l'ordre de lecture, sans rien résumer ni ajouter. Garde les titres sur leur propre ligne et les listes avec "- ". Écris les formules en texte lisible. Décris en une phrase entre crochets les schémas importants, par exemple [Schéma : le cycle de l'eau]. Si le document ne contient pas de texte lisible, réponds uniquement : AUCUN TEXTE.`;

/** Réponse « aucun texte » de la lecture d'un document. */
export const isNoText = (text: string) => !text.trim() || /^AUCUN TEXTE\.?$/i.test(text.trim());

/** Plafond de longueur de réponse selon le type (évite les réponses interminables). */
export const MAX_TOKENS: Record<TypeEtude, number> = {
  fiche: 8000,
  revision: 5000,
  quiz: 10000,
  flashcards: 8000,
  resume: 8000,
};

export function createStudyAI(options: GeneratorOptions = {}): StudyAI {
  const getClient = clientFactory(options);

  // Si le modèle décline pour raison de politique, l'API réessaie sur le modèle de repli.
  const base = (system: string) => ({
    model: MODEL,
    betas: ["server-side-fallback-2026-07-01"] satisfies Anthropic.Beta.AnthropicBeta[],
    fallbacks: "default" as const,
    system,
  });

  const textOf = (content: Anthropic.Beta.BetaContentBlock[]) =>
    content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

  return {
    async etude(input) {
      const client = getClient();
      const response = await client.beta.messages.parse({
        ...base(systemPrompt(input.niveau)),
        max_tokens: MAX_TOKENS[input.type],
        output_config: { effort: effortFromEnv(), format: betaZodOutputFormat(SCHEMAS[input.type]) },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: sourceBlock(input), cache_control: { type: "ephemeral" } },
              { type: "text", text: etudeInstructions(input) },
            ],
          },
        ],
      });
      checkStopReason(
        response.stop_reason,
        "La réponse de Claude a été coupée car elle était trop longue. Demande moins de questions ou de cartes, ou un cours plus court.",
      );
      if (!response.parsed_output) throw new UserFacingError("Claude a renvoyé une réponse illisible. Réessaie.", 502);
      return response.parsed_output;
    },

    async chat(input) {
      const client = getClient();
      const history = input.historique.slice(-12).map((m) => ({ role: m.role, content: m.texte }));
      // L'historique doit commencer par une question de l'élève.
      while (history.length && history[0].role !== "user") history.shift();
      const response = await client.beta.messages.create({
        ...base(""),
        system: [
          { type: "text", text: systemPrompt(input.niveau) },
          {
            type: "text",
            text: chatContext(input),
            cache_control: { type: "ephemeral" },
          },
        ],
        max_tokens: 3000,
        output_config: { effort: effortFromEnv() },
        messages: [...history, { role: "user", content: input.question }],
      });
      checkStopReason(response.stop_reason, "La réponse de Claude a été coupée. Pose une question plus précise.");
      const text = textOf(response.content);
      if (!text) throw new UserFacingError("Claude n'a pas su répondre. Reformule ta question.", 502);
      return text;
    },

    async simplifier(input) {
      const client = getClient();
      const response = await client.beta.messages.parse({
        ...base(systemPrompt(input.niveau)),
        max_tokens: 2000,
        output_config: { effort: effortFromEnv(), format: betaZodOutputFormat(SimplifierSchema) },
        messages: [
          {
            role: "user",
            content: simplifierPrompt(input),
          },
        ],
      });
      checkStopReason(response.stop_reason, "L'explication de Claude a été coupée. Réessaie sur un passage plus court.");
      const explication = response.parsed_output?.explication?.trim();
      if (!explication) throw new UserFacingError("Claude a renvoyé une réponse illisible. Réessaie.", 502);
      return explication;
    },

    async lire(input) {
      const client = getClient();
      const file =
        input.media === "application/pdf"
          ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.data } } as const)
          : ({ type: "image", source: { type: "base64", media_type: input.media, data: input.data } } as const);
      const response = await client.beta.messages.create({
        ...base(LIRE_SYSTEM),
        max_tokens: 8000,
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: [
              file,
              {
                type: "text",
                text: LIRE_PROMPT,
              },
            ],
          },
        ],
      });
      checkStopReason(response.stop_reason, "Ce document contient trop de texte pour être lu en une fois. Envoie-le en plusieurs photos.");
      const text = textOf(response.content);
      if (isNoText(text)) {
        throw new UserFacingError("Aucun texte lisible n'a été trouvé dans ce document. Essaie une photo plus nette.", 422);
      }
      return text;
    },
  };
}
