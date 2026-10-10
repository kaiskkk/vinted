// Lecture à voix haute avec la synthèse vocale du navigateur (gratuite, sans serveur), en français.
// Le texte est lu phrase par phrase : Chrome coupe les longues lectures, et la pause reste précise.

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Texte lisible : sans la mise en forme (**gras**, ==surligné==, puces, [trous]). */
export function speakable(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/==(.+?)==/g, "$1")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/\[([^\]\n]+)\]/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Découpe en morceaux d'au plus `max` caractères, en coupant de préférence entre deux phrases. */
export function chunks(text: string, max = 220): string[] {
  const out: string[] = [];
  for (const para of speakable(text).split(/\n+/)) {
    // (Pas de « lookbehind » dans l'expression : les anciens iPhone ne le comprennent pas.)
    const sentences = para
      .replace(/([.!?…;:])\s+/g, "$1\u0000")
      .split("\u0000")
      .filter((s) => s.trim());
    let cur = "";
    const push = () => {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    };
    for (const s of sentences) {
      if (s.length > max) {
        push();
        // Phrase trop longue : coupée aux virgules, puis aux espaces.
        let rest = s;
        while (rest.length > max) {
          const cut = Math.max(rest.lastIndexOf(", ", max), rest.lastIndexOf(" ", max));
          const at = cut > max / 3 ? cut + 1 : max;
          out.push(rest.slice(0, at).trim());
          rest = rest.slice(at);
        }
        cur = rest;
      } else if ((cur + " " + s).length > max) {
        push();
        cur = s;
      } else {
        cur = cur ? `${cur} ${s}` : s;
      }
    }
    push();
  }
  return out;
}

/** Meilleure voix française disponible (les voix « naturelles » ou de Google sonnent mieux). */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const fr = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  if (!fr.length) return null;
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.toLowerCase() === "fr-fr" ? 4 : 0) +
    (/(natural|neural|premium|enhanced|google|amélie|amelie|thomas|denise|henri)/i.test(v.name) ? 2 : 0) +
    (v.localService ? 1 : 0);
  return [...fr].sort((a, b) => score(b) - score(a))[0];
}

export const RATES = [0.8, 1, 1.25, 1.5];
const RATE_KEY = "ed-voix-vitesse";

export type ReaderStatus = "idle" | "playing" | "paused";
export interface ReaderState {
  status: ReaderStatus;
  /** Ce qui est lu (« Fiche : Les volcans »). */
  label: string;
  index: number;
  total: number;
  rate: number;
  /** Barre de lecture affichée (pas pendant une interrogation orale, qui a ses propres boutons). */
  bar: boolean;
}

export interface PlayOptions {
  bar?: boolean;
  /** Appelé quand la lecture va jusqu'au bout (pas si elle est arrêtée). */
  onEnd?: () => void;
}

function readRate(): number {
  try {
    const r = Number(localStorage.getItem(RATE_KEY));
    return RATES.includes(r) ? r : 1;
  } catch {
    return 1;
  }
}

/** Lecteur unique pour tout le site : une seule lecture à la fois. */
class Reader {
  private segments: string[] = [];
  private token = 0;
  private onEnd: (() => void) | null = null;
  state: ReaderState = { status: "idle", label: "", index: 0, total: 0, rate: 1, bar: true };
  private listeners = new Set<(s: ReaderState) => void>();

  constructor() {
    if (typeof window !== "undefined") this.state.rate = readRate();
  }

  subscribe(fn: (s: ReaderState) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(patch: Partial<ReaderState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }

  /** Lit une suite de textes (chacun est redécoupé en phrases). */
  play(texts: string[], label: string, options: PlayOptions = {}) {
    if (!speechSupported()) return;
    this.segments = texts.flatMap((t) => chunks(t)).filter(Boolean);
    this.onEnd = null;
    if (!this.segments.length) {
      this.stop();
      options.onEnd?.();
      return;
    }
    this.onEnd = options.onEnd ?? null;
    this.set({ status: "playing", label, index: 0, total: this.segments.length, bar: options.bar ?? true });
    this.speakFrom(0);
  }

  private speakFrom(index: number) {
    const synth = window.speechSynthesis;
    const token = ++this.token;
    synth.cancel();
    if (index >= this.segments.length) {
      const done = this.onEnd;
      this.onEnd = null;
      this.set({ status: "idle", index: 0, total: 0, label: "" });
      done?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(this.segments[index]);
    u.lang = "fr-FR";
    u.rate = this.state.rate;
    const voice = pickVoice(synth.getVoices());
    try {
      if (voice) u.voice = voice;
    } catch {
      // Voix refusée par le navigateur : la voix française par défaut (lang) fera l'affaire.
    }
    u.onend = () => {
      if (token !== this.token || this.state.status !== "playing") return;
      this.set({ index: index + 1 });
      this.speakFrom(index + 1);
    };
    u.onerror = (e) => {
      // « interrupted » / « canceled » : c'est nous qui avons arrêté.
      if (token !== this.token || e.error === "interrupted" || e.error === "canceled") return;
      this.set({ status: "idle", index: 0, total: 0, label: "" });
    };
    this.set({ index });
    synth.speak(u);
  }

  pause() {
    if (this.state.status !== "playing") return;
    // Pause « maison » : on s'arrête et on reprendra au début de la phrase (plus fiable que pause()).
    this.token++;
    window.speechSynthesis.cancel();
    this.set({ status: "paused" });
  }

  resume() {
    if (this.state.status !== "paused") return;
    this.set({ status: "playing" });
    this.speakFrom(this.state.index);
  }

  stop() {
    this.token++;
    this.onEnd = null;
    if (speechSupported()) window.speechSynthesis.cancel();
    this.segments = [];
    this.set({ status: "idle", index: 0, total: 0, label: "" });
  }

  /** Phrase précédente ou suivante. */
  skip(delta: number) {
    if (this.state.status === "idle") return;
    const index = Math.max(0, Math.min(this.segments.length - 1, this.state.index + delta));
    this.set({ status: "playing" });
    this.speakFrom(index);
  }

  setRate(rate: number) {
    try {
      localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      // Non mémorisé : sans gravité.
    }
    this.set({ rate });
    if (this.state.status === "playing") this.speakFrom(this.state.index);
  }
}

export const reader = new Reader();

// Les voix arrivent parfois après le chargement de la page (Chrome) : on les demande tôt.
if (speechSupported()) window.speechSynthesis.getVoices();
