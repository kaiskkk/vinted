// Saisie vocale avec la reconnaissance vocale du navigateur (gratuite, en français).

/** Constructeur de la reconnaissance vocale, ou null si le navigateur ne la propose pas (Firefox…). */
export function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const dictationSupported = () => speechRecognitionCtor() !== null;

/** Sous-ensemble de l'API utilisé ici (les types DOM ne sont pas fournis par tous les navigateurs). */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

/** Ponctuation dictée : « virgule », « point d'interrogation », « à la ligne »… */
const COMMANDS: [RegExp, string][] = [
  [/\s*\bpoint à la ligne\b\s*/gi, ".\n"],
  [/\s*\bnouveau paragraphe\b\s*/gi, "\n\n"],
  [/\s*\bà la ligne\b\s*/gi, "\n"],
  [/\s*\bpoint d'interrogation\b/gi, " ?"],
  [/\s*\bpoint d'exclamation\b/gi, " !"],
  [/\s*\bpoints de suspension\b/gi, "…"],
  [/\s*\bvirgule\b/gi, ","],
  [/\s*\bpoint final\b/gi, "."],
];

export function applyVoiceCommands(text: string): string {
  let out = text;
  for (const [re, by] of COMMANDS) out = out.replace(re, by);
  // Majuscule après une fin de phrase ou un retour à la ligne.
  return out.replace(/([.?!…]\s+|\n)([a-zà-ÿ])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

/** Ajoute le texte dicté à la suite de ce qui était déjà écrit, avec l'espace et la majuscule qui conviennent. */
export function joinDictation(before: string, spoken: string): string {
  let said = applyVoiceCommands(spoken.trim());
  if (!said) return before;
  const trimmed = before.replace(/[ \t]+$/, "");
  const startsSentence = !trimmed.trim() || /[.?!…:]$|\n$/.test(trimmed);
  if (startsSentence) said = said.charAt(0).toUpperCase() + said.slice(1);
  if (!trimmed) return said;
  const sep = /\n$/.test(trimmed) || /^[,.?!…\n]/.test(said) ? "" : " ";
  return trimmed + sep + said;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Le micro est bloqué. Autorise-le pour ce site (icône à gauche de l'adresse, ou réglages du téléphone), puis réessaie.",
  "service-not-allowed": "Le micro est bloqué. Autorise-le pour ce site dans les réglages du navigateur, puis réessaie.",
  "audio-capture": "Aucun micro n'a été trouvé sur cet appareil.",
  network: "La dictée a besoin d'internet : reconnecte-toi puis réessaie.",
  "language-not-supported": "La dictée en français n'est pas disponible sur ce navigateur.",
};

/** Message à afficher pour une erreur de la reconnaissance vocale (null si rien à signaler). */
export function dictationError(code: string): string | null {
  if (code === "aborted") return null;
  if (code === "no-speech") return "Je n'ai rien entendu. Touche le micro et parle un peu plus près.";
  return ERRORS[code] ?? "La dictée s'est arrêtée. Touche le micro pour reprendre.";
}
