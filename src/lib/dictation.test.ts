import { describe, expect, it } from "vitest";
import { applyVoiceCommands, dictationError, joinDictation } from "./dictation";

describe("saisie vocale", () => {
  it("ajoute le texte dicté avec l'espace et la majuscule qui conviennent", () => {
    expect(joinDictation("", "la révolution française")).toBe("La révolution française");
    expect(joinDictation("Elle commence", "en 1789")).toBe("Elle commence en 1789");
    expect(joinDictation("Fin de phrase.", "nouvelle phrase")).toBe("Fin de phrase. Nouvelle phrase");
    expect(joinDictation("Ligne\n", "suite")).toBe("Ligne\nSuite");
    expect(joinDictation("Texte  ", "   ")).toBe("Texte  ");
  });

  it("comprend la ponctuation dictée", () => {
    expect(applyVoiceCommands("bonjour virgule ça va point d'interrogation")).toBe("bonjour, ça va ?");
    expect(applyVoiceCommands("premier point à la ligne deuxième")).toBe("premier.\nDeuxième");
    expect(joinDictation("Avant", "virgule après")).toBe("Avant, après");
  });

  it("explique les erreurs du micro en français", () => {
    expect(dictationError("not-allowed")).toMatch(/micro est bloqué/);
    expect(dictationError("aborted")).toBeNull();
    expect(dictationError("no-speech")).toMatch(/rien entendu/);
  });
});
