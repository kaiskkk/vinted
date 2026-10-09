import { describe, expect, it } from "vitest";
import { chunks, pickVoice, speakable } from "./speech";

describe("lecture à voix haute", () => {
  it("retire la mise en forme", () => {
    expect(speakable("- **Le magma** est ==chaud==.\n- La [lave] coule.")).toBe("Le magma est chaud.\nLa lave coule.");
  });

  it("découpe en phrases courtes", () => {
    const text = "Première phrase. Deuxième phrase ! Troisième ?\nNouveau paragraphe.";
    expect(chunks(text, 30)).toEqual(["Première phrase.", "Deuxième phrase ! Troisième ?", "Nouveau paragraphe."]);
    const long = "mot ".repeat(100).trim();
    expect(chunks(long, 50).every((c) => c.length <= 50)).toBe(true);
    expect(chunks(long, 50).join(" ")).toBe(long);
  });

  it("choisit une voix française", () => {
    const v = (name: string, lang: string, localService = true) => ({ name, lang, localService }) as SpeechSynthesisVoice;
    expect(pickVoice([v("Samantha", "en-US"), v("Voix", "fr-CA"), v("Amélie", "fr-FR")])?.name).toBe("Amélie");
    expect(pickVoice([v("Voix", "fr-CA"), v("Google français", "fr-FR", false)])?.name).toBe("Google français");
    expect(pickVoice([v("Samantha", "en-US")])).toBeNull();
  });
});
