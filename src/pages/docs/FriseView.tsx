import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ShareButton } from "../../components/ShareButton";
import { ListenButton } from "../../components/ReadAloud";
import { docSegments } from "../../lib/docSpeech";
import { SavedIndicator } from "../../components/CanvasOverlays";
import { CheckIcon, PencilIcon, PlusIcon, RedoIcon, TrashIcon, UndoIcon } from "../../components/Icons";
import { btn } from "../../components/Modal";
import { SimplifyButton } from "../../components/Simplify";
import { useToast } from "../../components/Toasts";
import { AutoTextarea, Page, PageHeader, RichText, input } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import { sortEvents, type FriseDoc, type FriseEvenement, type FrisePeriode } from "../../lib/docs";
import { newId } from "../../lib/mapModel";
import { PrintButtons, printDate, useUndoShortcuts } from "./common";

export const PERIOD_COLORS = ["#14b8a6", "#6366f1", "#f59e0b", "#ec4899", "#22c55e", "#0ea5e9", "#a855f7", "#ef4444"];
const MONTHS = ["", "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export const formatYear = (y: number) => (y < 0 ? `${-y} av. J.-C.` : String(y));

/** Graduations « rondes » de l'axe (au plus 6). */
export function ticks(min: number, max: number): number[] {
  const span = Math.max(1, max - min);
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const step = steps.find((s) => span / s <= 5) ?? 100000;
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) out.push(t);
  return out;
}

/**
 * Champ d'année qui accepte les années négatives (av. J.-C.) : le texte tapé est gardé tel quel
 * pendant la saisie (« - », « -5 »…) et l'année n'est mise à jour que lorsqu'elle est lisible.
 */
function YearInput({ value, onChange, label, className }: { value: number; onChange: (n: number) => void; label: string; className: string }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);
  return (
    <input
      type="text"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(String(value));
      }}
      onChange={(e) => {
        const t = e.target.value
          .replace(/[^\d-]/g, "")
          .replace(/(?!^)-/g, "")
          .slice(0, 6);
        setText(t);
        const n = parseInt(t, 10);
        if (Number.isFinite(n)) onChange(Math.max(-99999, Math.min(3000, n)));
      }}
      aria-label={label}
      title="Année (négative pour avant J.-C., par exemple -52)"
      autoComplete="off"
      className={className}
    />
  );
}

const periodColor = (p: FrisePeriode, i: number) => p.couleur ?? PERIOD_COLORS[i % PERIOD_COLORS.length];

export function FriseView({ initial, onBack }: { initial: FriseDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, undo, redo, canUndo, canRedo, savedAt } = useDoc(initial, toast.error);
  const [editing, setEditing] = useState(initial.evenements.length === 0);
  useUndoShortcuts(undo, redo);

  const events = useMemo(() => sortEvents(doc.evenements), [doc.evenements]);
  const colorOfEvent = (e: FriseEvenement) => {
    if (e.couleur) return e.couleur;
    const i = doc.periodes.findIndex((p) => e.annee >= p.debut && e.annee <= p.fin);
    return i >= 0 ? periodColor(doc.periodes[i], i) : "#0d9488";
  };

  const setEvent = (id: string, patch: Partial<FriseEvenement>, key?: string) =>
    update((d) => ({ ...d, evenements: d.evenements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), { key });
  const setPeriod = (id: string, patch: Partial<FrisePeriode>, key?: string) =>
    update((d) => ({ ...d, periodes: d.periodes.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), { key });

  const addEvent = () => {
    const last = events.at(-1);
    const annee = last ? last.annee + 1 : new Date().getFullYear();
    const e: FriseEvenement = { id: newId(), annee, mois: 0, date: formatYear(annee), titre: "", description: "" };
    update((d) => ({ ...d, evenements: [...d.evenements, e] }));
    requestAnimationFrame(() => document.getElementById(`evt-${e.id}`)?.focus());
  };

  const finish = () => {
    const empty = doc.evenements.filter((e) => !e.titre.trim()).length;
    if (empty)
      toast.info(`${empty} événement${empty > 1 ? "s" : ""} sans titre ${empty > 1 ? "seront retirés" : "sera retiré"} au prochain chargement.`);
    update((d) => ({ ...d, evenements: sortEvents(d.evenements), periodes: [...d.periodes].sort((a, b) => a.debut - b.debut) }));
    setEditing(false);
  };

  // Étendue de l'axe : événements et périodes, avec une petite marge.
  const years = [...events.map((e) => e.annee + (e.mois ? (e.mois - 1) / 12 : 0)), ...doc.periodes.flatMap((p) => [p.debut, p.fin])];
  const min = years.length ? Math.min(...years) : 0;
  const max = years.length ? Math.max(...years) : 1;
  const pad = Math.max(0.5, (max - min) * 0.04);
  const lo = min - pad;
  const hi = max + pad;
  const pos = (y: number) => `${((y - lo) / (hi - lo)) * 100}%`;

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre}
        subtitle={`Frise chronologique · ${events.length} événement${events.length > 1 ? "s" : ""}`}
        onBack={onBack}
        width="max-w-4xl"
        actions={<SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />}
      />
      <div className="no-print mx-auto flex max-w-4xl gap-2 px-4 pt-4 sm:justify-end sm:px-6">
        {editing && (
          <>
            <button
              type="button"
              className={`${btn.icon} border border-slate-200 dark:border-slate-700`}
              onClick={undo}
              disabled={!canUndo}
              aria-label="Annuler"
              title="Annuler (Ctrl + Z)"
            >
              <UndoIcon size={17} />
            </button>
            <button
              type="button"
              className={`${btn.icon} border border-slate-200 dark:border-slate-700`}
              onClick={redo}
              disabled={!canRedo}
              aria-label="Rétablir"
              title="Rétablir (Ctrl + Y)"
            >
              <RedoIcon size={17} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => (editing ? finish() : setEditing(true))}
          className={`${editing ? btn.primary : btn.secondary} flex-1 sm:flex-none`}
        >
          {editing ? <CheckIcon size={17} /> : <PencilIcon size={16} />}
          {editing ? "Terminé" : "Modifier"}
        </button>
        {!editing && (
          <>
            <ListenButton texts={() => docSegments(doc)} label={`Frise : ${doc.titre}`} />
            <ShareButton kind={doc.type} id={doc.id} titre={doc.titre} />
            <PrintButtons />
          </>
        )}
      </div>

      <Page width="max-w-4xl" className="print-page">
        <article className="fiche">
          <header className="border-b-2 border-teal-500 pb-3">
            {editing ? (
              <input
                value={doc.titre}
                onChange={(e) => update((d) => ({ ...d, titre: e.target.value.slice(0, 140) }), { key: "titre" })}
                aria-label="Titre de la frise"
                className="fiche-input fiche-title"
              />
            ) : (
              <h1 className="fiche-title">{doc.titre}</h1>
            )}
          </header>

          {/* Vue d'ensemble proportionnelle */}
          {events.length > 0 && (
            <section className="print-avoid mt-5" aria-label="Vue d'ensemble">
              {doc.periodes.length > 0 && (
                <div className="relative h-7">
                  {doc.periodes.map((p, i) => (
                    <div
                      key={p.id}
                      className="absolute top-0 flex h-6 items-center overflow-hidden rounded-md px-1.5 text-[11px] font-semibold whitespace-nowrap text-white"
                      style={{ left: pos(p.debut), width: `calc(${pos(p.fin)} - ${pos(p.debut)})`, background: periodColor(p, i), minWidth: 6 }}
                      title={`${p.titre} (${formatYear(p.debut)} – ${formatYear(p.fin)})`}
                    >
                      <span className="truncate">{p.titre}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="relative mt-1 h-10">
                <div className="absolute inset-x-0 top-3 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                {events.map((e) => (
                  <span
                    key={e.id}
                    className="absolute top-1.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow dark:border-slate-900"
                    style={{ left: pos(e.annee + (e.mois ? (e.mois - 1) / 12 : 0)), background: colorOfEvent(e) }}
                    title={`${e.date} : ${e.titre}`}
                  />
                ))}
                {ticks(lo, hi).map((t) => (
                  <span
                    key={t}
                    className="absolute top-6 -translate-x-1/2 text-[10px] whitespace-nowrap text-slate-500 tabular-nums"
                    style={{ left: pos(t) }}
                  >
                    {formatYear(t)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Périodes */}
          {(doc.periodes.length > 0 || editing) && (
            <section className="mt-4" aria-labelledby="periodes">
              <h2 id="periodes" className="text-sm font-bold tracking-wider text-slate-500 uppercase">
                Périodes
              </h2>
              {editing ? (
                <ul className="mt-2 space-y-2">
                  {doc.periodes.map((p, i) => (
                    <li
                      key={p.id}
                      className="space-y-2 rounded-xl border border-slate-200 p-2 sm:flex sm:items-center sm:gap-2 sm:space-y-0 dark:border-slate-700"
                    >
                      <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                        <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: periodColor(p, i) }} aria-hidden="true" />
                        <input
                          value={p.titre}
                          onChange={(e) => setPeriod(p.id, { titre: e.target.value }, `pt-${p.id}`)}
                          placeholder="Nom de la période"
                          aria-label="Nom de la période"
                          className={`${input} h-11`}
                        />
                      </div>
                      <div className="flex items-center gap-2 pl-6 sm:pl-0">
                        <span className="w-24">
                          <YearInput
                            value={p.debut}
                            onChange={(debut) => setPeriod(p.id, { debut }, `pd-${p.id}`)}
                            label="Année de début"
                            className={`${input} h-11`}
                          />
                        </span>
                        <span className="text-slate-400" aria-hidden="true">
                          →
                        </span>
                        <span className="w-24">
                          <YearInput
                            value={p.fin}
                            onChange={(fin) => setPeriod(p.id, { fin }, `pf-${p.id}`)}
                            label="Année de fin"
                            className={`${input} h-11`}
                          />
                        </span>
                        <button
                          type="button"
                          className={`${btn.icon} ml-auto hover:text-red-600`}
                          onClick={() => update((d) => ({ ...d, periodes: d.periodes.filter((x) => x.id !== p.id) }))}
                          aria-label="Supprimer la période"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      className={`${btn.secondary} border-dashed`}
                      onClick={() => {
                        const debut = events[0]?.annee ?? new Date().getFullYear();
                        update((d) => ({ ...d, periodes: [...d.periodes, { id: newId(), titre: "", debut, fin: events.at(-1)?.annee ?? debut }] }));
                      }}
                    >
                      <PlusIcon size={15} /> Ajouter une période
                    </button>
                  </li>
                </ul>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {doc.periodes.map((p, i) => (
                    <li
                      key={p.id}
                      className="inline-flex items-center gap-2 rounded-xl px-3 py-1 text-sm"
                      style={{ background: `${periodColor(p, i)}22`, color: "inherit" }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: periodColor(p, i) }} aria-hidden="true" />
                      <strong>{p.titre}</strong>
                      <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                        {formatYear(p.debut)} – {formatYear(p.fin)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Frise détaillée */}
          <section className="mt-6" aria-label="Événements">
            {events.length === 0 && !editing && (
              <p className="text-slate-500">Cette frise est vide : touche « Modifier » pour ajouter des événements.</p>
            )}
            <ol className="relative">
              <span className="absolute top-2 bottom-2 left-[6.25rem] w-0.5 bg-slate-200 sm:left-[7.25rem] dark:bg-slate-700" aria-hidden="true" />
              {events.map((e) => {
                const color = colorOfEvent(e);
                return (
                  <li
                    key={e.id}
                    className="print-avoid relative grid grid-cols-[5.5rem_1fr] gap-x-6 py-2.5 sm:grid-cols-[6.5rem_1fr]"
                    style={{ "--c": color } as CSSProperties}
                  >
                    <span
                      className="absolute top-4 left-[6.25rem] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white shadow sm:left-[7.25rem] dark:border-slate-900"
                      style={{ background: color }}
                      aria-hidden="true"
                    />
                    {editing ? (
                      <>
                        <div className="space-y-1">
                          <YearInput
                            value={e.annee}
                            onChange={(annee) =>
                              setEvent(e.id, { annee, date: e.date === formatYear(e.annee) ? formatYear(annee) : e.date }, `ea-${e.id}`)
                            }
                            label="Année"
                            className={`${input} h-10 px-2`}
                          />
                          <select
                            value={e.mois}
                            onChange={(ev) => setEvent(e.id, { mois: Number(ev.target.value) })}
                            aria-label="Mois"
                            className={`${input} h-10 px-1 text-sm`}
                          >
                            {MONTHS.map((m, i) => (
                              <option key={i} value={i}>
                                {i === 0 ? "— mois" : m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="min-w-0 space-y-1.5 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                          <div className="flex gap-1">
                            <input
                              value={e.date}
                              onChange={(ev) => setEvent(e.id, { date: ev.target.value.slice(0, 80) }, `ed-${e.id}`)}
                              placeholder="Date affichée (ex. 14 juillet 1789)"
                              aria-label="Date affichée"
                              className={`${input} h-10 text-sm`}
                            />
                            <button
                              type="button"
                              className={`${btn.icon} shrink-0 hover:text-red-600`}
                              onClick={() => update((d) => ({ ...d, evenements: d.evenements.filter((x) => x.id !== e.id) }))}
                              aria-label="Supprimer l'événement"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </div>
                          <input
                            id={`evt-${e.id}`}
                            value={e.titre}
                            onChange={(ev) => setEvent(e.id, { titre: ev.target.value.slice(0, 140) }, `et-${e.id}`)}
                            placeholder="Événement"
                            aria-label="Titre de l'événement"
                            className={`${input} h-10 font-semibold`}
                          />
                          <AutoTextarea
                            value={e.description}
                            onChange={(v) => setEvent(e.id, { description: v.slice(0, 800) }, `ex-${e.id}`)}
                            minRows={1}
                            placeholder="Description (facultatif)"
                            aria-label="Description"
                            className={`${input} py-2 text-sm`}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="pt-1 text-right text-sm leading-snug font-bold break-words" style={{ color }}>
                          {e.date || formatYear(e.annee)}
                        </p>
                        <div className="min-w-0">
                          <div className="flex items-start gap-1">
                            <h3 className="flex-1 font-semibold">{e.titre}</h3>
                            <SimplifyButton compact text={`${e.date} : ${e.titre}. ${e.description}`} contexte={doc.titre} className="-my-1" />
                          </div>
                          {e.description && <RichText text={e.description} className="mt-0.5 text-sm text-slate-600 dark:text-slate-300" />}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
            {editing && (
              <button type="button" className={`${btn.secondary} no-print mt-2 w-full border-dashed`} onClick={addEvent}>
                <PlusIcon size={15} /> Ajouter un événement
              </button>
            )}
          </section>
          <footer className="fiche-foot">Frise ecoleduc · {printDate(doc.updatedAt)}</footer>
        </article>
      </Page>
    </div>
  );
}
