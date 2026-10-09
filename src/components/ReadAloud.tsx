import { useEffect, useState } from "react";
import { RATES, reader, speechSupported, type ReaderState } from "../lib/speech";
import { ArrowLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon, StopIcon, VolumeIcon } from "./Icons";
import { btn } from "./Modal";

export function useReader(): ReaderState {
  const [state, setState] = useState(reader.state);
  useEffect(() => reader.subscribe(setState), []);
  return state;
}

/**
 * Bouton « Écouter » : lit les textes à voix haute (ou arrête si c'est déjà en cours).
 * Invisible si le navigateur ne sait pas lire.
 */
export function ListenButton({
  texts,
  label,
  compact = false,
  className = "",
}: {
  /** Textes à lire, ou fonction appelée au moment de lire (contenu à jour). */
  texts: string[] | (() => string[]);
  label: string;
  compact?: boolean;
  className?: string;
}) {
  const state = useReader();
  const [supported] = useState(speechSupported);
  if (!supported) return null;
  const active = state.status !== "idle" && state.label === label;
  const toggle = () => {
    if (active) reader.stop();
    else reader.play(typeof texts === "function" ? texts() : texts, label);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? "Arrêter la lecture" : `Écouter : ${label}`}
      title={active ? "Arrêter la lecture" : "Écouter à voix haute"}
      className={`${compact ? btn.icon : `${btn.secondary} max-sm:min-w-11 max-sm:px-3`} ${active ? "text-indigo-600 dark:text-indigo-300" : ""} ${className}`}
    >
      {active ? <StopIcon size={compact ? 15 : 16} /> : <VolumeIcon size={compact ? 16 : 17} />}
      {/* Sur téléphone, l'icône seule laisse la place aux autres boutons. */}
      {!compact && <span className="max-sm:sr-only">{active ? "Arrêter" : "Écouter"}</span>}
    </button>
  );
}

/** Barre de lecture en bas de l'écran, visible pendant une lecture : pause, phrase précédente / suivante, vitesse, arrêt. */
export function ReadAloudBar() {
  const s = useReader();
  // Changer de page arrête la lecture.
  useEffect(() => {
    const stop = () => reader.stop();
    window.addEventListener("hashchange", stop);
    return () => window.removeEventListener("hashchange", stop);
  }, []);
  // Les notifications s'affichent au-dessus de la barre, pour ne pas la cacher.
  const visible = s.status !== "idle";
  useEffect(() => {
    const root = document.documentElement.style;
    if (visible) root.setProperty("--reader-bar", "4.5rem");
    else root.removeProperty("--reader-bar");
    return () => {
      root.removeProperty("--reader-bar");
    };
  }, [visible]);
  if (s.status === "idle") return null;
  const nextRate = RATES[(RATES.indexOf(s.rate) + 1) % RATES.length];
  const iconBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/15 active:scale-95";
  return (
    <div
      className="no-print fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[calc(0.75rem+var(--safe-bottom))]"
      role="region"
      aria-label="Lecture à voix haute"
    >
      <div className="flex w-full max-w-lg animate-slide-up items-center gap-1 rounded-2xl bg-slate-900/95 p-1.5 pl-3 text-white shadow-2xl backdrop-blur dark:bg-slate-800/95">
        <VolumeIcon size={18} className="shrink-0 text-indigo-300" />
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-medium">{s.label}</p>
          <p className="text-xs text-slate-300 tabular-nums">
            {s.status === "paused" ? "En pause" : "Lecture"} · {Math.min(s.index + 1, s.total)}/{s.total}
          </p>
        </div>
        <button type="button" className={`${iconBtn} max-[359px]:hidden`} onClick={() => reader.skip(-1)} aria-label="Phrase précédente">
          <ArrowLeftIcon size={17} />
        </button>
        <button
          type="button"
          className={`${iconBtn} bg-white/10`}
          onClick={() => (s.status === "playing" ? reader.pause() : reader.resume())}
          aria-label={s.status === "playing" ? "Pause" : "Reprendre"}
        >
          {s.status === "playing" ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
        </button>
        <button type="button" className={iconBtn} onClick={() => reader.skip(1)} aria-label="Phrase suivante">
          <ChevronRightIcon size={20} />
        </button>
        <button
          type="button"
          className="h-11 min-w-12 shrink-0 rounded-full px-2 text-sm font-semibold tabular-nums transition hover:bg-white/15"
          onClick={() => reader.setRate(nextRate)}
          aria-label={`Vitesse ${s.rate}×, toucher pour passer à ${nextRate}×`}
        >
          {String(s.rate).replace(".", ",")}×
        </button>
        <button type="button" className={iconBtn} onClick={() => reader.stop()} aria-label="Arrêter la lecture">
          <StopIcon size={16} />
        </button>
      </div>
    </div>
  );
}
