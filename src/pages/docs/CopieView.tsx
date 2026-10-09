import { SavedIndicator } from "../../components/CanvasOverlays";
import { CardsIcon, CheckIcon } from "../../components/Icons";
import { btn } from "../../components/Modal";
import { ListenButton } from "../../components/ReadAloud";
import { ShareButton } from "../../components/ShareButton";
import { useToast } from "../../components/Toasts";
import { Page, PageHeader, RichText, card } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import { openDoc } from "../../hooks/useHashRoute";
import { docSegments } from "../../lib/docSpeech";
import { flashcardsFromCopie, saveDoc, touchClasseur, type CopieDoc, type Exercice } from "../../lib/docs";
import { recordActivity } from "../../lib/serie";
import { PrintButtons, printDate } from "./common";
import { ExerciceCard, ExercicesPrint } from "./ExercicesView";

export function CopieView({ initial, onBack }: { initial: CopieDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, savedAt } = useDoc(initial, toast.error);
  const comprises = doc.erreurs.filter((e) => e.comprise).length;

  const changeEx = (id: string) => (patch: Partial<Exercice>, key?: string) =>
    update((d) => ({ ...d, exercices: d.exercices.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), { key });

  const toggle = (id: string) => {
    update((d) => ({ ...d, erreurs: d.erreurs.map((e) => (e.id === id ? { ...e, comprise: !e.comprise } : e)) }));
    recordActivity("copie");
  };

  const makeFlashcards = () => {
    try {
      const deck = flashcardsFromCopie(doc);
      saveDoc(deck);
      touchClasseur(doc.classeurId);
      toast.success("Tes erreurs sont devenues des flashcards : révise-les pour ne plus les refaire !");
      openDoc(deck.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    }
  };

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre}
        subtitle={["Ma copie", doc.matiere, doc.note].filter(Boolean).join(" · ")}
        onBack={onBack}
        width="max-w-3xl"
        actions={<SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />}
      />
      <div className="no-print mx-auto flex max-w-3xl flex-wrap gap-2 px-4 pt-4 sm:justify-end sm:px-6">
        {doc.erreurs.length > 0 && (
          <button type="button" className={`${btn.secondary} whitespace-nowrap max-sm:basis-full`} onClick={makeFlashcards}>
            <CardsIcon size={16} /> Flashcards de mes erreurs
          </button>
        )}
        <ListenButton texts={() => docSegments(doc)} label={`Ma copie : ${doc.titre}`} />
        <ShareButton kind="copie" id={doc.id} titre={doc.titre} />
        <PrintButtons />
      </div>

      <Page width="max-w-3xl" className="print-page">
        <section className={`${card} flex items-start gap-4 p-4 sm:p-5`} aria-label="Bilan">
          {doc.note && (
            <span className="flex h-16 min-w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-yellow-400 to-amber-500 px-2 text-lg font-extrabold text-white shadow-lg shadow-amber-500/30 tabular-nums">
              {doc.note}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">{doc.matiere ? `Bilan · ${doc.matiere}` : "Bilan"}</h2>
            {doc.bilan && <RichText text={doc.bilan} className="mt-1 text-slate-700 dark:text-slate-200" />}
          </div>
        </section>

        {doc.pointsForts.length > 0 && (
          <section className="mt-5" aria-labelledby="forts">
            <h2 id="forts" className="font-bold text-emerald-700 dark:text-emerald-400">
              👍 Ce que tu as bien fait
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {doc.pointsForts.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>
        )}

        {doc.erreurs.length > 0 && (
          <section className="mt-6" aria-labelledby="erreurs">
            <div className="flex items-baseline gap-2">
              <h2 id="erreurs" className="flex-1 font-bold text-orange-700 dark:text-orange-400">
                🔧 Mes erreurs, expliquées
              </h2>
              <span className="text-sm text-slate-500 tabular-nums dark:text-slate-400">
                {comprises}/{doc.erreurs.length} comprise{comprises > 1 ? "s" : ""}
              </span>
            </div>
            <ol className="mt-3 space-y-3">
              {doc.erreurs.map((e, i) => (
                <li key={e.id} className={`${card} print-avoid p-4 ${e.comprise ? "opacity-70" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2 text-sm">
                      {e.extrait && (
                        <blockquote className="border-l-2 border-red-300 pl-2 text-slate-500 italic line-through decoration-red-400/60 dark:text-slate-400">
                          {e.extrait}
                        </blockquote>
                      )}
                      {e.explication && <RichText text={e.explication} />}
                      {e.correction && (
                        <p className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
                          <strong className="text-emerald-700 dark:text-emerald-300">Correction : </strong>
                          {e.correction}
                        </p>
                      )}
                      {e.conseil && <p className="text-slate-600 dark:text-slate-300">💡 {e.conseil}</p>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(e.id)}
                    aria-pressed={e.comprise}
                    className={`no-print mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition tap:min-h-11 ${
                      e.comprise
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <CheckIcon size={16} /> {e.comprise ? "J'ai compris" : "J'ai compris cette erreur"}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {doc.notions.length > 0 && (
          <section className="print-avoid mt-6" aria-labelledby="notions">
            <h2 id="notions" className="font-bold">
              📚 À revoir dans le cours
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {doc.notions.map((n, i) => (
                <li key={i} className="rounded-full bg-yellow-100 px-3 py-1 text-sm text-yellow-900 dark:bg-yellow-500/15 dark:text-yellow-200">
                  {n}
                </li>
              ))}
            </ul>
          </section>
        )}

        {doc.exercices.length > 0 && (
          <section className="mt-8" aria-labelledby="entrainement">
            <h2 id="entrainement" className="no-print font-bold">
              🏋️ Pour t'entraîner
            </h2>
            <div className="no-print mt-3 space-y-4">
              {doc.exercices.map((ex, i) => (
                <ExerciceCard key={ex.id} ex={ex} index={i} contexte={doc.titre} onChange={changeEx(ex.id)} />
              ))}
            </div>
            <ExercicesPrint titre="Pour t'entraîner" exercices={doc.exercices} date={doc.updatedAt} />
          </section>
        )}
        <p className="mt-6 hidden text-right text-xs text-slate-500 print:block">Analyse ecoleduc · {printDate(doc.updatedAt)}</p>
      </Page>
    </div>
  );
}
