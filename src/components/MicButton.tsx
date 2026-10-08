import { useEffect, useRef, useState } from "react";
import { dictationError, joinDictation, speechRecognitionCtor, type SpeechRecognitionLike } from "../lib/dictation";
import { MicIcon } from "./Icons";
import { useToast } from "./Toasts";

/** Une seule dictée à la fois dans tout le site. */
let active: SpeechRecognitionLike | null = null;

/**
 * Bouton micro : le texte dicté (en français) s'ajoute à la suite de la zone de texte.
 * Invisible si le navigateur ne propose pas la reconnaissance vocale.
 * Sur téléphone, la dictée s'arrête après une pause : on touche à nouveau le micro pour continuer.
 */
export function MicButton({
  value,
  onChange,
  className = "",
  label = "Dicter au micro",
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  label?: string;
  /** Longueur maximale du champ. */
  max?: number;
}) {
  const toast = useToast();
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [supported] = useState(() => speechRecognitionCtor() !== null);

  useEffect(
    () => () => {
      rec.current?.abort();
      if (active === rec.current) active = null;
    },
    [],
  );

  if (!supported) return null;

  const stop = () => rec.current?.stop();

  const start = () => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    active?.abort();
    const r = new Ctor();
    r.lang = "fr-FR";
    r.interimResults = true;
    r.maxAlternatives = 1;
    // En continu, Chrome sur Android répète les phrases : une phrase à la fois sur écran tactile.
    r.continuous = !window.matchMedia("(pointer: coarse)").matches;
    const base = valueRef.current;
    r.onresult = (e) => {
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript.trim());
      const next = joinDictation(base, parts.filter(Boolean).join(" "));
      onChangeRef.current(max ? next.slice(0, max) : next);
    };
    r.onerror = (e) => {
      const message = dictationError(e.error);
      if (!message) return;
      if (e.error === "no-speech") toast.info(message);
      else toast.error(message);
    };
    r.onend = () => {
      if (rec.current === r) {
        rec.current = null;
        setListening(false);
      }
      if (active === r) active = null;
    };
    try {
      r.start();
      rec.current = r;
      active = r;
      setListening(true);
    } catch {
      toast.error("La dictée n'a pas pu démarrer. Réessaie dans un instant.");
    }
  };

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      aria-pressed={listening}
      aria-label={listening ? "Arrêter la dictée" : label}
      title={listening ? "Arrêter la dictée" : `${label} (dis « virgule », « point d'interrogation », « à la ligne »…)`}
      className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 tap:h-11 tap:w-11 ${
        listening
          ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      } ${className}`}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-xl bg-red-500/40" aria-hidden="true" />}
      <MicIcon size={18} className="relative" />
    </button>
  );
}
