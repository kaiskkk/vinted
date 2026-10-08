// Choix de l'IA à chaque appel : Gemini (gratuit) si la variable CLE_GEMINI existe, sinon Claude.
// Sur Netlify sans aucune clé, Claude passe par l'AI Gateway de Netlify (payé en crédits Netlify).
import { MODEL, createClaudeGenerator, hasCredentials, type GeneratorOptions, type MindMapGenerator } from "./claude";
import { createGeminiProvider, geminiKey, geminiModel } from "./gemini";
import { createStudyAI, type StudyAI } from "./study";

export const usesGemini = () => Boolean(geminiKey());

export function createAI(options: GeneratorOptions = {}) {
  const claude = { generator: createClaudeGenerator(options), study: createStudyAI(options) };
  const gemini = createGeminiProvider(options);
  const pick = () => (usesGemini() ? gemini : claude);

  const generator: MindMapGenerator = { generate: (input) => pick().generator.generate(input) };
  const study: StudyAI = {
    etude: (input) => pick().study.etude(input),
    redaction: (input) => pick().study.redaction(input),
    chat: (input) => pick().study.chat(input),
    simplifier: (input) => pick().study.simplifier(input),
    lire: (input) => pick().study.lire(input),
  };
  return {
    generator,
    study,
    hasApiKey: () => usesGemini() || hasCredentials(),
    modelName: () => (usesGemini() ? geminiModel() : MODEL),
  };
}
