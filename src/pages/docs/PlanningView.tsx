import { useEffect, useMemo, useRef, useState } from "react";
import { ShareButton } from "../../components/ShareButton";
import { ListenButton } from "../../components/ReadAloud";
import { docSegments } from "../../lib/docSpeech";
import { SavedIndicator } from "../../components/CanvasOverlays";
import { CheckIcon, PencilIcon, RefreshIcon } from "../../components/Icons";
import { Modal, btn } from "../../components/Modal";
import { useToast } from "../../components/Toasts";
import { Page, PageHeader, card, input } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import type { PlanningDoc, TacheGenre } from "../../lib/docs";
import { addDays, buildPlanning, daysBetween, parseChapitres, parseDay, today } from "../../lib/planning";
import { recordActivity } from "../../lib/serie";
import { PrintButtons } from "./common";

const GENRES: Record<TacheGenre, { label: string; chip: string }> = {
  apprendre: { label: "Apprendre", chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  reviser: { label: "Réviser", chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  bilan: { label: "Bilan", chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  examen: { label: "Examen", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function dayLabel(date: string, now: string) {
  const diff = daysBetween(now, date);
  const full = longDay.format(parseDay(date));
  if (diff === 0) return { main: "Aujourd'hui", sub: full };
  if (diff === 1) return { main: "Demain", sub: full };
  if (diff === -1) return { main: "Hier", sub: full };
  return { main: full.charAt(0).toUpperCase() + full.slice(1), sub: "" };
}

export function PlanningView({ initial, onBack }: { initial: PlanningDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, savedAt } = useDoc(initial, toast.error);
  const [now] = useState(today);
  const [editing, setEditing] = useState(false);
  const todayRef = useRef<HTMLLIElement>(null);

  const all = doc.jours.flatMap((j) => j.taches).filter((t) => t.genre !== "examen");
  const done = all.filter((t) => t.fait).length;
  const progress = all.length ? Math.round((done / all.length) * 100) : 0;
  const remaining = daysBetween(now, doc.dateExamen);
  const late = useMemo(
    () =>
      doc.jours.filter((j) => daysBetween(j.date, now) > 0).reduce((n, j) => n + j.taches.filter((t) => !t.fait && t.genre !== "examen").length, 0),
    [doc.jours, now],
  );

  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const toggle = (date: string, id: string) => {
    const tache = doc.jours.find((j) => j.date === date)?.taches.find((t) => t.id === id);
    if (tache && !tache.fait) recordActivity("planning");
    update((d) => ({
      ...d,
      jours: d.jours.map((j) => (j.date === date ? { ...j, taches: j.taches.map((t) => (t.id === id ? { ...t, fait: !t.fait } : t)) } : j)),
    }));
  };

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre}
        subtitle={`Examen le ${longDay.format(parseDay(doc.dateExamen))}`}
        onBack={onBack}
        width="max-w-3xl"
        actions={<SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />}
      />
      <Page width="max-w-3xl" className="print-page">
        <section className={`${card} print-avoid p-4 sm:p-5`}>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30">
              {remaining > 0 ? (
                <>
                  <span className="text-xs font-medium opacity-85">J -</span>
                  <span className="-mt-1 text-2xl font-extrabold">{remaining}</span>
                </>
              ) : (
                <span className="text-center text-sm leading-tight font-bold">{remaining === 0 ? "Jour J" : "Fini"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {done} / {all.length} séances faites
              </p>
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progression"
              >
                <div className="h-full rounded-full bg-linear-to-r from-rose-500 to-pink-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              {late > 0 && (
                <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {late} séance{late > 1 ? "s" : ""} en retard : rattrape-les ou recalcule le planning.
                </p>
              )}
            </div>
          </div>
          <div className="no-print mt-4 flex flex-wrap gap-2">
            <button type="button" className={btn.secondary} onClick={() => setEditing(true)}>
              <PencilIcon size={15} /> Modifier
            </button>
            <ListenButton texts={() => docSegments(doc)} label={`Planning : ${doc.titre}`} />
            <ShareButton kind={doc.type} id={doc.id} titre={doc.titre} />
            <PrintButtons />
          </div>
        </section>

        <ol className="mt-5 space-y-3">
          {doc.jours.map((j) => {
            const label = dayLabel(j.date, now);
            const isToday = j.date === now;
            const past = daysBetween(j.date, now) > 0;
            return (
              <li
                key={j.date}
                ref={isToday ? todayRef : undefined}
                className={`print-avoid scroll-mt-24 rounded-2xl border p-3 sm:p-4 ${
                  isToday
                    ? "border-rose-400 bg-rose-50/70 ring-2 ring-rose-400/30 dark:border-rose-500/60 dark:bg-rose-500/10"
                    : "border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60"
                } ${past && j.taches.every((t) => t.fait) ? "opacity-60" : ""}`}
              >
                <p className="flex items-baseline gap-2">
                  <span className="font-semibold">{label.main}</span>
                  {label.sub && <span className="text-xs text-slate-500 dark:text-slate-400">{label.sub}</span>}
                </p>
                {j.taches.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Jour plus léger : 10 minutes de flashcards suffisent.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {j.taches.map((t) => (
                      <li key={t.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <input
                            type="checkbox"
                            checked={t.fait}
                            onChange={() => toggle(j.date, t.id)}
                            disabled={t.genre === "examen"}
                            className="peer sr-only"
                          />
                          {t.genre !== "examen" && (
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-rose-400 ${
                                t.fait ? "border-rose-500 bg-rose-500 text-white" : "border-slate-300 dark:border-slate-600"
                              }`}
                              aria-hidden="true"
                            >
                              {t.fait && <CheckIcon size={15} strokeWidth={3} />}
                            </span>
                          )}
                          <span className={`min-w-0 flex-1 text-sm ${t.fait ? "text-slate-400 line-through" : ""}`}>{t.texte}</span>
                          <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${GENRES[t.genre].chip}`}>
                            {GENRES[t.genre].label}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </Page>

      {editing && (
        <EditPlanning
          doc={doc}
          onClose={() => setEditing(false)}
          onSave={(patch) => {
            update((d) => ({ ...d, ...patch }));
            setEditing(false);
            toast.success("Planning recalculé.");
          }}
        />
      )}
    </div>
  );
}

function EditPlanning({
  doc,
  onClose,
  onSave,
}: {
  doc: PlanningDoc;
  onClose: () => void;
  onSave: (patch: Pick<PlanningDoc, "titre" | "dateExamen" | "debut" | "chapitres" | "jours">) => void;
}) {
  const toast = useToast();
  const [titre, setTitre] = useState(doc.titre);
  const [examen, setExamen] = useState(doc.dateExamen);
  const [chapitres, setChapitres] = useState(doc.chapitres.join("\n"));
  const start = today();

  const save = () => {
    try {
      const list = parseChapitres(chapitres);
      if (!list.length) throw new Error("Ajoute au moins un chapitre (un par ligne).");
      onSave({ titre: titre.trim() || doc.titre, dateExamen: examen, debut: start, chapitres: list, jours: buildPlanning(list, start, examen) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Planning impossible.");
    }
  };

  return (
    <Modal
      title="Modifier le planning"
      onClose={onClose}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose}>
            Annuler
          </button>
          <button className={btn.primary} onClick={save}>
            <RefreshIcon size={15} /> Recalculer
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Nom
          <input value={titre} onChange={(e) => setTitre(e.target.value)} className={`${input} mt-1 h-11`} />
        </label>
        <label className="block text-sm font-medium">
          Date de l'examen
          <input type="date" value={examen} min={addDays(start, 1)} onChange={(e) => setExamen(e.target.value)} className={`${input} mt-1 h-11`} />
        </label>
        <label className="block text-sm font-medium">
          Chapitres (un par ligne)
          <textarea value={chapitres} onChange={(e) => setChapitres(e.target.value)} rows={5} className={`${input} mt-1 resize-y py-2`} />
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">Le planning repart d'aujourd'hui ; les cases cochées sont remises à zéro.</p>
      </div>
    </Modal>
  );
}
