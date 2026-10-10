import { useEffect, useState } from "react";
import type { Route } from "../hooks/useHashRoute";
import { recordActivity } from "../lib/serie";
import {
  DUREES_PAUSE,
  DUREES_TRAVAIL,
  formatTemps,
  getMinuteur,
  isRunning,
  nextPhase,
  pauseTimer,
  remaining,
  resume,
  setMinuteur,
  start,
  stop,
  subscribeMinuteur,
  type MinuteurState,
} from "../lib/minuteur";
import { ClockIcon, PauseIcon, PlayIcon, StopIcon } from "./Icons";
import { Modal, btn } from "./Modal";
import { useToast } from "./Toasts";
import { Segmented } from "./ui";

// ---------- Ouverture de la fenêtre, depuis n'importe où ----------

let panelOpen = false;
const panelListeners = new Set<() => void>();
export const openMinuteur = () => {
  panelOpen = true;
  panelListeners.forEach((l) => l());
};
const closeMinuteur = () => {
  panelOpen = false;
  panelListeners.forEach((l) => l());
};

/** État du minuteur, rafraîchi chaque seconde pendant qu'il tourne. */
export function useMinuteur(): [MinuteurState, number] {
  const [s, setS] = useState(getMinuteur);
  const [now, setNow] = useState(Date.now);
  useEffect(() => subscribeMinuteur(setS), []);
  useEffect(() => {
    // Heure à jour dès que le minuteur change (sinon il afficherait l'heure de la dernière seconde passée).
    setNow(Date.now());
    if (!isRunning(s)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s]);
  return [s, now];
}

// ---------- Son, vibration et notification de fin ----------

let audio: AudioContext | null = null;

/** Le son doit être « débloqué » par un geste de l'élève : on prépare le lecteur quand il démarre le minuteur. */
function unlockAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    void audio?.resume();
  } catch {
    audio = null;
  }
}

function sonner() {
  try {
    if (audio) {
      const t0 = audio.currentTime;
      [0, 0.28, 0.56].forEach((d) => {
        const o = audio!.createOscillator();
        const g = audio!.createGain();
        o.frequency.value = 880;
        o.connect(g);
        g.connect(audio!.destination);
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
        o.start(t0 + d);
        o.stop(t0 + d + 0.24);
      });
    }
  } catch {
    // Pas de son : le message suffit.
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Vibration indisponible.
  }
}

function notifier(text: string) {
  if (!("Notification" in window) || Notification.permission !== "granted" || document.visibilityState === "visible") return;
  const sw = "serviceWorker" in navigator ? navigator.serviceWorker.getRegistration() : Promise.resolve(undefined);
  void sw
    .then((reg) => {
      if (reg) return reg.showNotification("ecoleduc", { body: text, icon: "/icons/icon-192.png", tag: "minuteur" });
      new Notification("ecoleduc", { body: text });
    })
    .catch(() => {});
}

/** Passe d'une phase à l'autre au bon moment, où que soit l'élève dans le site. */
export function MinuteurWatcher() {
  const toast = useToast();
  useEffect(() => {
    const check = () => {
      const s = getMinuteur();
      if (!isRunning(s) || (s.fin as number) > Date.now()) return;
      const late = Date.now() - (s.fin as number);
      if (s.phase === "travail") {
        recordActivity("minuteur");
        // Site fermé pendant toute la pause : la séance compte, le minuteur s'arrête simplement.
        if (late > s.pause * 60_000) {
          setMinuteur(stop({ ...s, seances: s.seances + 1 }));
          toast.success(`Ta séance de ${s.travail} minutes est terminée. Bravo !`);
          return;
        }
        setMinuteur(nextPhase(s));
        const text = `Bravo ! ${s.travail} minutes de révision 💪 Fais une pause de ${s.pause} minutes.`;
        toast.success(text);
        notifier(text);
      } else {
        setMinuteur(nextPhase(s));
        const text = "La pause est finie : on s'y remet ?";
        toast.success(text, { label: `Reprendre (${s.travail} min)`, onClick: () => (unlockAudio(), setMinuteur(start(getMinuteur()))) });
        notifier(text);
      }
      sonner();
    };
    check();
    const t = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [toast]);
  return null;
}

// ---------- Pastille pendant que le minuteur tourne ----------

/** En bas à gauche, sur toutes les pages sauf l'éditeur de cartes (qui a ses propres barres). */
export function MinuteurPill({ route }: { route: Route }) {
  const [s, now] = useMinuteur();
  if (!s.phase || route.page === "editor") return null;
  const travail = s.phase === "travail";
  return (
    <button
      type="button"
      onClick={openMinuteur}
      className={`no-print fixed left-3 z-40 inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-bold text-white shadow-lg transition active:scale-95 ${
        travail
          ? "bg-linear-to-r from-indigo-600 to-violet-600 shadow-indigo-500/30"
          : "bg-linear-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30"
      } ${s.fin === null ? "opacity-80" : ""}`}
      style={{ bottom: "calc(0.75rem + var(--safe-bottom) + var(--reader-bar, 0px))" }}
      aria-label={`Minuteur : ${travail ? "révision" : "pause"}, ${formatTemps(remaining(s, now))} restantes${s.fin === null ? " (en pause)" : ""}`}
    >
      <span aria-hidden="true">{travail ? "🧠" : "☕"}</span>
      <span className="tabular-nums">{formatTemps(remaining(s, now))}</span>
      {s.fin === null && <PauseIcon size={13} />}
    </button>
  );
}

// ---------- Bouton de l'accueil ----------

export function MinuteurButton() {
  const [s, now] = useMinuteur();
  return (
    <button
      type="button"
      onClick={openMinuteur}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-px hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
    >
      <ClockIcon size={16} className="text-indigo-500" />
      {s.phase ? `${s.phase === "travail" ? "Révision" : "Pause"} · ${formatTemps(remaining(s, now))}` : "Minuteur de révision"}
    </button>
  );
}

// ---------- Fenêtre du minuteur ----------

export function MinuteurPanel() {
  const [open, setOpen] = useState(panelOpen);
  const [s, now] = useMinuteur();
  useEffect(() => {
    const l = () => setOpen(panelOpen);
    panelListeners.add(l);
    return () => {
      panelListeners.delete(l);
    };
  }, []);
  if (!open) return null;

  const begin = () => {
    unlockAudio();
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
    setMinuteur(start(s));
  };
  const total = (s.phase === "pause" ? s.pause : s.travail) * 60_000;
  const left = remaining(s, now);

  return (
    <Modal
      title="Minuteur de révision"
      onClose={closeMinuteur}
      footer={
        <button type="button" className={btn.secondary} onClick={closeMinuteur}>
          Fermer
        </button>
      }
    >
      {!s.phase ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Révise sans t'arrêter pendant un temps court, puis fais une vraie pause : c'est la méthode « Pomodoro ». Le site te prévient à la fin,
            même si tu changes de page.
          </p>
          <div>
            <p className="text-sm font-semibold">Temps de révision</p>
            <Segmented
              label="Temps de révision"
              value={s.travail}
              onChange={(travail) => setMinuteur({ ...s, travail })}
              oneLine
              className="mt-1.5"
              options={DUREES_TRAVAIL.map((m) => ({ value: m, label: `${m} min` }))}
            />
          </div>
          <div>
            <p className="text-sm font-semibold">Pause</p>
            <Segmented
              label="Temps de pause"
              value={s.pause}
              onChange={(pause) => setMinuteur({ ...s, pause })}
              oneLine
              className="mt-1.5"
              options={DUREES_PAUSE.map((m) => ({ value: m, label: `${m} min` }))}
            />
          </div>
          <button
            type="button"
            onClick={begin}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 active:scale-[0.98]"
          >
            <PlayIcon size={16} /> Démarrer · {s.travail} min
          </button>
          {s.seances > 0 && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {s.seances} séance{s.seances > 1 ? "s" : ""} aujourd'hui 💪
            </p>
          )}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {s.phase === "travail" ? "🧠 Révision en cours" : "☕ Pause"} {s.fin === null && "· en pause"}
          </p>
          <p className="mt-1 text-6xl font-extrabold tabular-nums" aria-live="off">
            {formatTemps(left)}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-all ${s.phase === "travail" ? "bg-linear-to-r from-indigo-500 to-violet-500" : "bg-linear-to-r from-emerald-500 to-teal-500"}`}
              style={{ width: `${Math.min(100, ((total - left) / total) * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {s.phase === "travail"
              ? "Range ton téléphone et concentre-toi sur une seule chose. Le site te prévient à la fin."
              : "Lève-toi, bois de l'eau, regarde au loin. La révision reprend juste après."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {s.fin === null ? (
              <button type="button" className={btn.primary} onClick={() => setMinuteur(resume(s))}>
                <PlayIcon size={15} /> Reprendre
              </button>
            ) : (
              <button type="button" className={btn.secondary} onClick={() => setMinuteur(pauseTimer(s))}>
                <PauseIcon size={15} /> Mettre en pause
              </button>
            )}
            <button type="button" className={`${btn.secondary} text-red-600 dark:text-red-400`} onClick={() => setMinuteur(stop(s))}>
              <StopIcon size={14} /> Arrêter
            </button>
          </div>
          {s.seances > 0 && (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {s.seances} séance{s.seances > 1 ? "s" : ""} aujourd'hui 💪
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
