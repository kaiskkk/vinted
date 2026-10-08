import { useEffect, useState } from "react";
import { openSerie } from "../hooks/useHashRoute";
import { onSerieChange, serieStats, type SerieStats } from "../lib/serie";
import { useToast } from "./Toasts";

/** Statistiques de la série, mises à jour dès qu'une activité est notée. */
export function useSerie(): SerieStats {
  const [stats, setStats] = useState(() => serieStats());
  useEffect(() => onSerieChange((s) => setStats(s)), []);
  return stats;
}

/** Pastille « 🔥 3 » en haut de l'accueil ; ouvre la page de la série. */
export function SeriePill() {
  const s = useSerie();
  const label = `Série de révision : ${s.actuelle} jour${s.actuelle > 1 ? "s" : ""}${s.aujourdhui ? "" : ", pas encore révisé aujourd'hui"}`;
  return (
    <button
      type="button"
      onClick={openSerie}
      title={label}
      aria-label={label}
      className={`inline-flex min-h-10 items-center gap-1 rounded-xl border px-2.5 text-sm font-bold tabular-nums transition hover:-translate-y-px tap:min-h-11 ${
        s.aujourdhui
          ? "border-orange-300 bg-orange-50 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300"
          : "border-slate-200 bg-white/80 text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400"
      }`}
    >
      <span aria-hidden="true" className={s.aujourdhui ? "" : "opacity-50 grayscale"}>
        🔥
      </span>
      {s.actuelle}
    </button>
  );
}

/** Félicite l'élève quand un badge est débloqué (où qu'il soit dans le site). */
export function SerieWatcher() {
  const toast = useToast();
  useEffect(
    () =>
      onSerieChange((s, nouveaux) => {
        for (const b of nouveaux) toast.success(`${b.emoji} Nouveau badge : « ${b.nom} » (${b.jours} jour${b.jours > 1 ? "s" : ""} de suite) !`);
        if (!nouveaux.length && s.actuelle > 1) toast.info(`🔥 ${s.actuelle} jours de révision d'affilée !`);
      }),
    [toast],
  );
  return null;
}
