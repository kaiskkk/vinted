import { useMemo, useState } from "react";
import { ChevronRightIcon } from "../components/Icons";
import { useSerie } from "../components/Serie";
import { Page, PageHeader, card } from "../components/ui";
import { goHome } from "../hooks/useHashRoute";
import { isoDay, today } from "../lib/planning";
import { BADGES, nextBadge, serieMessage } from "../lib/serie";

const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** Jours d'un mois, en commençant au lundi (cases vides avant le 1er). */
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => isoDay(new Date(year, month, i + 1, 12)))];
}

export default function SeriePage() {
  const s = useSerie();
  const now = today();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const activeThisMonth = grid.filter((d) => d && s.jours.has(d)).length;
  const next = nextBadge(s.record);
  const move = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const isCurrentMonth = cursor.year === new Date().getFullYear() && cursor.month === new Date().getMonth();

  return (
    <div className="min-h-dvh">
      <PageHeader title="Ma série de révision" onBack={goHome} backLabel="Retour à l'accueil" width="max-w-3xl" />
      <Page width="max-w-3xl">
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center gap-5 bg-linear-to-br from-orange-500 via-amber-500 to-rose-500 p-5 text-white sm:p-6">
            <span className="text-6xl drop-shadow-lg sm:text-7xl" aria-hidden="true">
              🔥
            </span>
            <div className="min-w-0">
              <p className="text-5xl font-extrabold tabular-nums">{s.actuelle}</p>
              <p className="font-semibold">jour{s.actuelle > 1 ? "s" : ""} de révision d'affilée</p>
              <p className="mt-1 text-sm text-white/90">{serieMessage(s)}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-slate-100 text-center dark:divide-slate-800">
            <div className="p-3">
              <dd className="text-2xl font-bold tabular-nums">{s.record}</dd>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Record</dt>
            </div>
            <div className="p-3">
              <dd className="text-2xl font-bold tabular-nums">{s.total}</dd>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Jours révisés</dt>
            </div>
            <div className="p-3">
              <dd className="text-2xl font-bold tabular-nums">{BADGES.filter((b) => s.record >= b.jours).length}</dd>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Badges</dt>
            </div>
          </dl>
          {next && (
            <p className="border-t border-slate-100 px-4 py-3 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              Prochain badge :{" "}
              <strong>
                {next.emoji} {next.nom}
              </strong>{" "}
              — encore {next.jours - s.actuelle} jour{next.jours - s.actuelle > 1 ? "s" : ""} de suite.
            </p>
          )}
        </section>

        <section className={`${card} mt-6 p-4 sm:p-5`} aria-labelledby="calendrier">
          <div className="mx-auto flex max-w-md items-center gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Mois précédent"
            >
              <ChevronRightIcon size={18} className="rotate-180" />
            </button>
            <h2 id="calendrier" className="flex-1 text-center font-semibold capitalize">
              {monthFormat.format(new Date(cursor.year, cursor.month, 1))}
            </h2>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={isCurrentMonth}
              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
              aria-label="Mois suivant"
            >
              <ChevronRightIcon size={18} />
            </button>
          </div>
          <div className="mx-auto mt-3 grid max-w-md grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400" aria-hidden="true">
            {WEEKDAYS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <ol className="mx-auto mt-1 grid max-w-md grid-cols-7 gap-1">
            {grid.map((d, i) => {
              if (!d) return <li key={`v${i}`} aria-hidden="true" />;
              const active = s.jours.has(d);
              const isToday = d === now;
              return (
                <li
                  key={d}
                  className={`flex aspect-square items-center justify-center rounded-xl text-sm tabular-nums ${
                    active
                      ? "bg-linear-to-br from-orange-400 to-rose-500 font-bold text-white shadow-sm"
                      : d > now
                        ? "text-slate-300 dark:text-slate-700"
                        : "bg-slate-50 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400"
                  } ${isToday ? "ring-2 ring-orange-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""}`}
                  aria-label={`${d}${active ? " : révisé" : ""}`}
                >
                  {Number(d.slice(8))}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            {activeThisMonth} jour{activeThisMonth > 1 ? "s" : ""} révisé{activeThisMonth > 1 ? "s" : ""} ce mois-ci
          </p>
        </section>

        <section className="mt-6" aria-labelledby="badges">
          <h2 id="badges" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Badges
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BADGES.map((b) => {
              const ok = s.record >= b.jours;
              return (
                <li key={b.jours} className={`${card} flex flex-col items-center p-4 text-center ${ok ? "" : "opacity-60"}`}>
                  <span className={`text-4xl ${ok ? "" : "grayscale"}`} aria-hidden="true">
                    {ok ? b.emoji : "🔒"}
                  </span>
                  <span className="mt-2 text-sm font-semibold">{b.nom}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {b.jours} jour{b.jours > 1 ? "s" : ""} de suite{ok ? " · débloqué" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Une journée compte dès que tu fais un quiz, une séance de flashcards, une séance de ton planning, une génération avec l'IA, une question sur
          un cours, une aide à la rédaction, ou que tu modifies une fiche. Pas besoin de tout faire : un seul geste suffit !
        </p>
      </Page>
    </div>
  );
}
