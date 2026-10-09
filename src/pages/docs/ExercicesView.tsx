import { useState } from "react";
import { DIFFICULTES } from "../../../shared/study";
import { SavedIndicator } from "../../components/CanvasOverlays";
import { CheckIcon, LightbulbIcon, RotateIcon } from "../../components/Icons";
import { MicButton } from "../../components/MicButton";
import { btn } from "../../components/Modal";
import { ListenButton } from "../../components/ReadAloud";
import { ShareButton } from "../../components/ShareButton";
import { SimplifyButton } from "../../components/Simplify";
import { useToast } from "../../components/Toasts";
import { AutoTextarea, Page, PageHeader, RichText, card, input } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import { docSegments } from "../../lib/docSpeech";
import type { Exercice, ExerciceStatut, ExercicesDoc } from "../../lib/docs";
import { recordActivity } from "../../lib/serie";
import { PrintButtons, printDate } from "./common";

const STATUT_LOOK: Record<ExerciceStatut, { label: string; className: string } | null> = {
  "a-faire": null,
  reussi: { label: "Réussi", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  "a-revoir": { label: "À revoir", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
};

/**
 * Un exercice : énoncé, réponse de l'élève (écrite ou dictée), indices dévoilés un par un,
 * puis correction étape par étape. Utilisé par les exercices et par l'analyse d'une copie.
 */
export function ExerciceCard({
  ex,
  index,
  contexte,
  onChange,
}: {
  ex: Exercice;
  index: number;
  contexte: string;
  onChange: (patch: Partial<Exercice>, key?: string) => void;
}) {
  const [hints, setHints] = useState(0);
  // Nombre d'étapes de correction affichées (0 : correction cachée).
  const [steps, setSteps] = useState(0);
  const look = STATUT_LOOK[ex.statut];
  const allSteps = steps >= ex.etapes.length;

  const mark = (statut: ExerciceStatut) => {
    onChange({ statut });
    recordActivity("exercice");
  };

  return (
    <article className={`${card} print-avoid p-4 sm:p-5`} aria-labelledby={`ex-${ex.id}`}>
      <header className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white" aria-hidden="true">
          {index + 1}
        </span>
        <h3 id={`ex-${ex.id}`} className="min-w-0 flex-1 pt-1 font-semibold">
          {ex.titre || `Exercice ${index + 1}`}
        </h3>
        {look && <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${look.className}`}>{look.label}</span>}
      </header>

      <RichText text={ex.enonce} className="mt-3 leading-relaxed" />
      <div className="no-print mt-1 flex items-center">
        <ListenButton compact texts={[ex.enonce]} label={`Énoncé de l'exercice ${index + 1}`} />
        <SimplifyButton compact text={ex.enonce} contexte={contexte} />
      </div>

      <div className="no-print mt-3">
        <label className="text-sm font-semibold" htmlFor={`rep-${ex.id}`}>
          Ma réponse
        </label>
        <div className="mt-1.5 flex items-start gap-1">
          <AutoTextarea
            id={`rep-${ex.id}`}
            value={ex.maReponse}
            onChange={(v) => onChange({ maReponse: v.slice(0, 5000) }, `rep-${ex.id}`)}
            minRows={2}
            placeholder="Écris ou dicte ta démarche et ton résultat…"
            className={`${input} py-2.5 text-[15px]`}
          />
          <MicButton value={ex.maReponse} max={5000} onChange={(v) => onChange({ maReponse: v }, `rep-${ex.id}`)} label="Dicter ma réponse" />
        </div>
      </div>

      {hints > 0 && (
        <ol className="mt-3 space-y-2">
          {ex.indices.slice(0, hints).map((h, i) => (
            <li key={i} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
              <LightbulbIcon size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
              <span>
                <strong>Indice {i + 1} :</strong> {h}
              </span>
            </li>
          ))}
        </ol>
      )}

      {steps > 0 && (
        <section
          className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-500/30 dark:bg-blue-500/10"
          aria-label="Correction"
        >
          <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200">Correction</h4>
          <ol className="mt-2 space-y-2 text-sm">
            {ex.etapes.slice(0, steps).map((s, i) => (
              <li key={i} className="flex animate-fade-in gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <RichText text={s} className="min-w-0 flex-1 pt-0.5" />
              </li>
            ))}
          </ol>
          {allSteps && ex.reponse && (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold dark:bg-slate-900">
              Résultat : <span className="text-blue-700 dark:text-blue-300">{ex.reponse}</span>
            </p>
          )}
        </section>
      )}

      <div className="no-print mt-3 flex flex-wrap gap-2">
        {steps === 0 && hints < ex.indices.length && (
          <button type="button" className={`${btn.secondary} flex-1 sm:flex-none`} onClick={() => setHints((h) => h + 1)}>
            <LightbulbIcon size={16} className="text-amber-500" /> {hints ? "Un autre indice" : "Un indice"} ({hints + 1}/{ex.indices.length})
          </button>
        )}
        {steps === 0 ? (
          <button type="button" className={`${btn.secondary} flex-1 sm:flex-none`} onClick={() => setSteps(1)}>
            Voir la correction
          </button>
        ) : !allSteps ? (
          <>
            <button type="button" className={`${btn.primary} flex-1 sm:flex-none`} onClick={() => setSteps((s) => s + 1)}>
              Étape suivante ({steps + 1}/{ex.etapes.length})
            </button>
            <button type="button" className={btn.secondary} onClick={() => setSteps(ex.etapes.length)}>
              Tout afficher
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-pressed={ex.statut === "reussi"}
              className={`${btn.secondary} flex-1 sm:flex-none ${ex.statut === "reussi" ? "border-emerald-400 text-emerald-700 dark:text-emerald-300" : ""}`}
              onClick={() => mark("reussi")}
            >
              <CheckIcon size={16} /> J'avais juste
            </button>
            <button
              type="button"
              aria-pressed={ex.statut === "a-revoir"}
              className={`${btn.secondary} flex-1 sm:flex-none ${ex.statut === "a-revoir" ? "border-amber-400 text-amber-700 dark:text-amber-300" : ""}`}
              onClick={() => mark("a-revoir")}
            >
              <RotateIcon size={15} /> À revoir
            </button>
          </>
        )}
      </div>
    </article>
  );
}

/** Version imprimable : les énoncés, puis les corrigés à la fin. */
export function ExercicesPrint({ titre, exercices, date }: { titre: string; exercices: Exercice[]; date: number }) {
  return (
    <article className="fiche print-page hidden print:block">
      <h1 className="fiche-title">{titre}</h1>
      <ol className="mt-4 space-y-4">
        {exercices.map((e, i) => (
          <li key={e.id} className="print-avoid">
            <p className="font-bold">
              Exercice {i + 1}
              {e.titre ? ` — ${e.titre}` : ""}
            </p>
            <RichText text={e.enonce} className="mt-1" />
          </li>
        ))}
      </ol>
      <h2 className="mt-8 border-t pt-4 text-lg font-bold">Corrigés</h2>
      <ol className="mt-2 space-y-3 text-sm">
        {exercices.map((e, i) => (
          <li key={e.id} className="print-avoid">
            <p className="font-semibold">Exercice {i + 1}</p>
            <ol className="list-decimal pl-5">
              {e.etapes.map((s, k) => (
                <li key={k}>{s}</li>
              ))}
            </ol>
            {e.reponse && <p className="font-semibold">Résultat : {e.reponse}</p>}
          </li>
        ))}
      </ol>
      <footer className="fiche-foot">Exercices ecoleduc · {printDate(date)}</footer>
    </article>
  );
}

export function ExercicesView({ initial, onBack }: { initial: ExercicesDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, savedAt } = useDoc(initial, toast.error);
  const reussis = doc.exercices.filter((e) => e.statut === "reussi").length;
  const difficulte = DIFFICULTES.find((d) => d.value === doc.difficulte)?.label ?? "";

  const change = (id: string) => (patch: Partial<Exercice>, key?: string) =>
    update((d) => ({ ...d, exercices: d.exercices.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), { key });

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre}
        subtitle={`Exercices · ${doc.exercices.length} · ${difficulte}`}
        onBack={onBack}
        width="max-w-3xl"
        actions={<SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />}
      />
      <div className="no-print mx-auto flex max-w-3xl items-center gap-2 px-4 pt-4 sm:px-6">
        <p className="flex-1 text-sm text-slate-600 dark:text-slate-300">
          <strong className="tabular-nums">
            {reussis}/{doc.exercices.length}
          </strong>{" "}
          réussi{reussis > 1 ? "s" : ""}
        </p>
        <ListenButton texts={() => docSegments(doc)} label={`Exercices : ${doc.titre}`} />
        <ShareButton kind="exercices" id={doc.id} titre={doc.titre} />
        <PrintButtons />
      </div>
      <Page width="max-w-3xl">
        <div className="no-print space-y-4">
          {doc.exercices.map((ex, i) => (
            <ExerciceCard key={ex.id} ex={ex} index={i} contexte={doc.titre} onChange={change(ex.id)} />
          ))}
        </div>
        <ExercicesPrint titre={doc.titre} exercices={doc.exercices} date={doc.updatedAt} />
      </Page>
    </div>
  );
}
