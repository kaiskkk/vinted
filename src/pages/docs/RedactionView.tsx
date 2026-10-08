import { useState } from "react";
import { TYPES_DEVOIR, type PlanIA, type RelectureIA } from "../../../shared/study";
import { SavedIndicator } from "../../components/CanvasOverlays";
import { CheckIcon, ChevronRightIcon, PencilIcon, SparklesIcon, TrashIcon } from "../../components/Icons";
import { MicButton } from "../../components/MicButton";
import { btn } from "../../components/Modal";
import { useToast } from "../../components/Toasts";
import {
  AutoTextarea,
  ClaudeTaskOverlay,
  NiveauPicker,
  Page,
  PageHeader,
  Segmented,
  card,
  input,
  useClaudeTask,
  useNiveau,
} from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import { proposePlan, relireTexte, type DevoirInfo } from "../../lib/api";
import { wordCount, type RedactionDoc } from "../../lib/docs";
import { newId } from "../../lib/mapModel";
import { recordActivity } from "../../lib/serie";
import { PrintButtons, printDate } from "./common";

type Tab = "plan" | "texte" | "relectures";
const MIN_WORDS = 30;
const ROMAN = ["I", "II", "III", "IV", "V"];
const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const typeLabel = (t: RedactionDoc["typeDevoir"]) => TYPES_DEVOIR.find((x) => x.value === t)?.label ?? "Devoir";
const devoirOf = (doc: RedactionDoc): DevoirInfo => ({
  typeDevoir: doc.typeDevoir,
  sujet: doc.sujet,
  ...(doc.matiere ? { matiere: doc.matiere } : {}),
  ...(doc.typeDevoir === "commentaire" && doc.document.trim() ? { document: doc.document } : {}),
});

/** Trame du plan (titres seulement) pour démarrer le brouillon : l'élève rédige le reste. */
export function planOutline(plan: PlanIA): string {
  const lines = ["Introduction", ""];
  plan.parties.forEach((p, i) => {
    lines.push(`${ROMAN[i] ?? i + 1}. ${p.titre}`);
    p.sousParties.forEach((s, j) => lines.push(`${String.fromCharCode(65 + j)}. ${s.titre}`, ""));
  });
  lines.push("Conclusion", "");
  return lines.join("\n");
}

export function RedactionView({ initial, onBack }: { initial: RedactionDoc; onBack: () => void }) {
  const toast = useToast();
  const task = useClaudeTask();
  const [niveau] = useNiveau();
  const { doc, update, savedAt } = useDoc(initial, toast.error);
  const [tab, setTab] = useState<Tab>(initial.brouillon.trim() ? "texte" : "plan");
  const [editSujet, setEditSujet] = useState(false);
  const mots = wordCount(doc.brouillon);
  const info = TYPES_DEVOIR.find((t) => t.value === doc.typeDevoir);

  const askPlan = () => {
    if (doc.plan && !window.confirm("Remplacer le plan actuel par une nouvelle proposition ?")) return;
    void task.run("L'IA réfléchit à ton sujet…", async (signal) => {
      const plan = await proposePlan(devoirOf(doc), niveau, signal);
      update((d) => ({ ...d, plan }));
      recordActivity("redaction");
      setTab("plan");
    });
  };

  const askRelecture = () => {
    if (mots < MIN_WORDS) {
      toast.error(`Écris au moins ${MIN_WORDS} mots pour que la relecture soit utile (tu en es à ${mots}).`);
      return;
    }
    const texte = doc.brouillon;
    void task.run("L'IA relit ton texte…", async (signal) => {
      const resultat = await relireTexte(devoirOf(doc), texte, niveau, signal);
      update((d) => ({ ...d, relectures: [...d.relectures, { id: newId(), date: Date.now(), mots: wordCount(texte), resultat }].slice(-20) }));
      recordActivity("redaction");
      setTab("relectures");
    });
  };

  const insertOutline = () => {
    if (!doc.plan) return;
    const outline = planOutline(doc.plan);
    update((d) => ({ ...d, brouillon: d.brouillon.trim() ? `${d.brouillon.trimEnd()}\n\n${outline}` : outline }));
    setTab("texte");
    toast.success("La trame du plan est dans ton brouillon : à toi de rédiger chaque partie !");
  };

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre}
        subtitle={[typeLabel(doc.typeDevoir), doc.matiere].filter(Boolean).join(" · ")}
        onBack={onBack}
        width="max-w-3xl"
        actions={<SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />}
      />
      <Page width="max-w-3xl">
        {/* Le sujet */}
        <section className={`${card} no-print p-4 sm:p-5`} aria-labelledby="sujet">
          <div className="flex items-start gap-2">
            <h2 id="sujet" className="flex-1 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Le sujet
            </h2>
            <button type="button" className={`${btn.secondary} -my-1 min-h-9 px-3`} onClick={() => setEditSujet((v) => !v)}>
              {editSujet ? <CheckIcon size={15} /> : <PencilIcon size={14} />}
              {editSujet ? "OK" : "Modifier"}
            </button>
          </div>
          {editSujet ? (
            <div className="mt-3 space-y-3">
              <Segmented
                label="Type de devoir"
                value={doc.typeDevoir}
                onChange={(typeDevoir) => update((d) => ({ ...d, typeDevoir }))}
                options={TYPES_DEVOIR.map((t) => ({ value: t.value, label: t.label }))}
              />
              <div className="flex items-start gap-1">
                <AutoTextarea
                  value={doc.sujet}
                  onChange={(v) =>
                    update((d) => ({ ...d, sujet: v.slice(0, 3000), titre: v.split("\n")[0].slice(0, 90) || d.titre }), { key: "sujet" })
                  }
                  minRows={2}
                  aria-label="Sujet"
                  className={`${input} py-2.5`}
                />
                <MicButton
                  value={doc.sujet}
                  max={3000}
                  onChange={(v) => update((d) => ({ ...d, sujet: v, titre: v.split("\n")[0].slice(0, 90) || d.titre }), { key: "sujet" })}
                />
              </div>
              <input
                value={doc.matiere}
                onChange={(e) => update((d) => ({ ...d, matiere: e.target.value.slice(0, 100) }), { key: "matiere" })}
                placeholder="Matière (facultatif)"
                aria-label="Matière"
                className={`${input} h-11`}
              />
              {doc.typeDevoir === "commentaire" && (
                <AutoTextarea
                  value={doc.document}
                  onChange={(v) => update((d) => ({ ...d, document: v.slice(0, 60_000) }), { key: "document" })}
                  minRows={4}
                  placeholder="Colle ici le texte ou le document à commenter"
                  aria-label="Document à commenter"
                  className={`${input} max-h-[40dvh] overflow-y-auto py-2.5 text-sm`}
                />
              )}
            </div>
          ) : (
            <>
              <p className="mt-2 font-medium whitespace-pre-line">{doc.sujet}</p>
              {doc.typeDevoir === "commentaire" && doc.document.trim() && (
                <details className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                  <summary className="cursor-pointer font-medium">Le document à commenter</summary>
                  <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-line text-slate-600 dark:text-slate-300">{doc.document}</p>
                </details>
              )}
            </>
          )}
        </section>

        <p className="no-print mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          ✍️ L'IA t'aide à réfléchir et à t'améliorer, mais c'est <strong>toi</strong> qui écris ton devoir.
        </p>

        <Segmented
          label="Étape"
          value={tab}
          onChange={setTab}
          oneLine
          className="no-print sticky top-[calc(3.5rem+var(--safe-top))] z-20 mt-5 shadow-sm"
          options={[
            { value: "plan", label: "1. Plan" },
            { value: "texte", label: `2. Texte${mots ? ` (${mots})` : ""}` },
            { value: "relectures", label: `3. Relecture${doc.relectures.length ? ` (${doc.relectures.length})` : ""}` },
          ]}
        />

        {tab === "plan" && (
          <section className="mt-5" aria-label="Problématique et plan">
            {!doc.plan ? (
              <div className={`${card} p-5 text-center sm:p-8`}>
                <p className="text-lg font-semibold">Par où commencer ?</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-300">
                  L'IA analyse ton sujet et te propose des problématiques et un plan détaillé
                  {doc.typeDevoir === "expose" ? " pour ton oral" : ""}, avec des idées et des exemples à développer.
                </p>
                <button
                  type="button"
                  onClick={askPlan}
                  disabled={task.busy}
                  className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-red-500 to-orange-500 px-5 font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                  <SparklesIcon size={18} /> Proposer une problématique et un plan
                </button>
                <NiveauPicker className="mx-auto mt-4 justify-center" />
              </div>
            ) : (
              <>
                <div className="no-print mb-3 flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    className={`${btn.secondary} flex-1 whitespace-nowrap sm:flex-none`}
                    onClick={insertOutline}
                    title="Copie les titres du plan dans ton texte, pour rédiger partie par partie"
                  >
                    <ChevronRightIcon size={16} /> Copier la trame
                  </button>
                  <button type="button" className={`${btn.secondary} flex-1 whitespace-nowrap sm:flex-none`} onClick={askPlan} disabled={task.busy}>
                    <SparklesIcon size={16} /> Autre plan
                  </button>
                  <div className="ml-auto flex">
                    <PrintButtons compact />
                  </div>
                </div>
                <PlanSheet doc={doc} plan={doc.plan} />
              </>
            )}
          </section>
        )}

        {tab === "texte" && (
          <section className="mt-5" aria-label="Mon texte">
            <div className={`${card} p-3 sm:p-4 print:hidden`}>
              <AutoTextarea
                value={doc.brouillon}
                onChange={(v) => update((d) => ({ ...d, brouillon: v.slice(0, 40_000) }), { key: "brouillon" })}
                minRows={12}
                placeholder={
                  doc.typeDevoir === "expose"
                    ? "Écris ici les notes de ton exposé…"
                    : "Écris ici ton devoir. Tu peux aussi le dicter avec le micro, ou coller un texte écrit ailleurs."
                }
                aria-label="Mon texte"
                className="w-full resize-none bg-transparent py-1 text-base leading-relaxed outline-none"
              />
              <div className="no-print mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                <MicButton value={doc.brouillon} max={40_000} onChange={(v) => update((d) => ({ ...d, brouillon: v }), { key: "brouillon" })} />
                <span className="flex-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {mots} mot{mots > 1 ? "s" : ""}
                </span>
                <PrintButtons compact />
              </div>
            </div>
            <div className="no-print mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <NiveauPicker />
              <div className="hidden flex-1 sm:block" />
              <button
                type="button"
                onClick={askRelecture}
                disabled={task.busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-red-500 to-orange-500 px-5 font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                <SparklesIcon size={18} /> Faire relire mon texte
              </button>
            </div>
            <p className="no-print mt-2 text-xs text-slate-500 dark:text-slate-400">
              L'IA ne corrige pas à ta place : elle te dit ce qui va bien, ce qui peut être amélioré, et comment t'y prendre.
            </p>
          </section>
        )}

        {tab === "relectures" && (
          <section className="mt-5 space-y-4" aria-label="Relectures">
            {doc.relectures.length === 0 ? (
              <div className={`${card} p-6 text-center text-slate-600 dark:text-slate-300`}>
                <p className="font-semibold">Aucune relecture pour l'instant</p>
                <p className="mt-1 text-sm">Écris ton texte à l'étape 2, puis touche « Faire relire mon texte ».</p>
                <button type="button" className={`${btn.secondary} mt-4`} onClick={() => setTab("texte")}>
                  Aller à mon texte
                </button>
              </div>
            ) : (
              [...doc.relectures]
                .reverse()
                .map((r, i) => (
                  <RelectureCard
                    key={r.id}
                    resultat={r.resultat}
                    title={i === 0 ? "Dernière relecture" : `Relecture du ${dateTime.format(r.date)}`}
                    meta={`${dateTime.format(r.date)} · ${r.mots} mots`}
                    defaultOpen={i === 0}
                    onDelete={() => update((d) => ({ ...d, relectures: d.relectures.filter((x) => x.id !== r.id) }))}
                  />
                ))
            )}
          </section>
        )}

        {/* Version imprimable : le sujet, puis l'étape affichée */}
        {tab === "texte" && (
          <article className="fiche print-page hidden print:block">
            <h1 className="fiche-title">{doc.titre}</h1>
            <p className="fiche-subtitle">
              {info?.label} {doc.matiere && `· ${doc.matiere}`} · {printDate(doc.updatedAt)}
            </p>
            <p className="mt-4 font-semibold whitespace-pre-line">{doc.sujet}</p>
            <div className="mt-5 leading-relaxed whitespace-pre-line">{doc.brouillon}</div>
          </article>
        )}
      </Page>
      <ClaudeTaskOverlay task={task} />
    </div>
  );
}

function PlanSheet({ doc, plan }: { doc: RedactionDoc; plan: PlanIA }) {
  const intro = plan.introduction;
  return (
    <article className="fiche print-page">
      <header className="border-b-2 border-orange-500 pb-3">
        <p className="text-xs font-bold tracking-wider text-orange-600 uppercase dark:text-orange-400">
          {typeLabel(doc.typeDevoir)} {doc.matiere && `· ${doc.matiere}`}
        </p>
        <h1 className="fiche-title mt-1">{doc.sujet.split("\n")[0]}</h1>
      </header>

      {plan.problematiques.length > 0 && (
        <section className="print-avoid mt-5">
          <h2 className="text-sm font-bold tracking-wider text-slate-500 uppercase">Problématiques possibles</h2>
          <ul className="mt-2 space-y-2">
            {plan.problematiques.map((p, i) => (
              <li key={i} className="rounded-xl border-l-4 border-orange-400 bg-orange-50 px-3 py-2 font-medium dark:bg-orange-500/10">
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="print-avoid mt-6">
        <h2 className="text-lg font-bold">Introduction</h2>
        <dl className="mt-2 space-y-2 text-sm">
          {(
            [
              ["Accroche", intro.accroche],
              ["Présentation du sujet", intro.presentation],
              ["Problématique", intro.problematique],
              ["Annonce du plan", intro.annonce],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="font-semibold text-slate-500 dark:text-slate-400">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      </section>

      {plan.parties.map((p, i) => (
        <section key={i} className="mt-6">
          <h2 className="text-lg font-bold">
            <span className="text-orange-600 dark:text-orange-400">{ROMAN[i] ?? i + 1}.</span> {p.titre}
          </h2>
          <ol className="mt-2 space-y-3">
            {p.sousParties.map((s, j) => (
              <li key={j} className="print-avoid rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="font-semibold">
                  {String.fromCharCode(65 + j)}. {s.titre}
                </p>
                {s.idees.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm">
                    {s.idees.map((x, k) => (
                      <li key={k}>{x}</li>
                    ))}
                  </ul>
                )}
                {s.exemples.length > 0 && (
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Exemples : </span>
                    {s.exemples.join(" ; ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="print-avoid mt-6">
        <h2 className="text-lg font-bold">Conclusion</h2>
        <dl className="mt-2 space-y-2 text-sm">
          {plan.conclusion.bilan && (
            <div>
              <dt className="font-semibold text-slate-500 dark:text-slate-400">Bilan</dt>
              <dd>{plan.conclusion.bilan}</dd>
            </div>
          )}
          {plan.conclusion.ouverture && (
            <div>
              <dt className="font-semibold text-slate-500 dark:text-slate-400">Ouverture</dt>
              <dd>{plan.conclusion.ouverture}</dd>
            </div>
          )}
        </dl>
      </section>

      {plan.conseils.length > 0 && (
        <section className="print-avoid mt-6 rounded-xl bg-sky-50 p-3 text-sm dark:bg-sky-500/10">
          <h2 className="font-bold">💡 Conseils pour rédiger</h2>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {plan.conseils.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}
      <footer className="fiche-foot">Plan ecoleduc · {printDate(doc.updatedAt)}</footer>
    </article>
  );
}

function RelectureCard({
  resultat,
  title,
  meta,
  defaultOpen,
  onDelete,
}: {
  resultat: RelectureIA;
  title: string;
  meta: string;
  defaultOpen: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className={`${card} print-page overflow-hidden`}>
      <div className="flex items-center gap-2 p-4">
        <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="block font-semibold">{title}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{meta}</span>
        </button>
        <button type="button" className={`${btn.icon} no-print hover:text-red-600`} onClick={onDelete} aria-label="Supprimer cette relecture">
          <TrashIcon size={16} />
        </button>
        <ChevronRightIcon size={18} className={`no-print shrink-0 text-slate-400 transition ${open ? "rotate-90" : ""}`} />
      </div>
      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4 text-sm dark:border-slate-800">
          {resultat.appreciation && <p className="text-base">{resultat.appreciation}</p>}
          {resultat.pointsForts.length > 0 && (
            <section>
              <h3 className="font-bold text-emerald-700 dark:text-emerald-400">👍 Points forts</h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {resultat.pointsForts.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </section>
          )}
          {resultat.aAmeliorer.length > 0 && (
            <section>
              <h3 className="font-bold text-orange-700 dark:text-orange-400">🔧 À améliorer</h3>
              <ul className="mt-2 space-y-2.5">
                {resultat.aAmeliorer.map((a, i) => (
                  <li key={i} className="print-avoid rounded-xl bg-orange-50 p-3 dark:bg-orange-500/10">
                    {a.extrait && (
                      <blockquote className="border-l-2 border-orange-300 pl-2 text-slate-500 italic dark:text-slate-400">« {a.extrait} »</blockquote>
                    )}
                    <p className="mt-1 font-medium">{a.probleme}</p>
                    {a.conseil && <p className="mt-0.5 text-slate-700 dark:text-slate-200">→ {a.conseil}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {resultat.langue.length > 0 && (
            <section>
              <h3 className="font-bold text-sky-700 dark:text-sky-400">📝 Langue (orthographe, grammaire, style)</h3>
              <ul className="mt-2 space-y-1.5">
                {resultat.langue.map((l, i) => (
                  <li key={i}>
                    {l.extrait && <span className="rounded bg-sky-100 px-1 dark:bg-sky-500/20">« {l.extrait} »</span>} {l.remarque}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {resultat.prochaineEtape && (
            <p className="rounded-xl bg-indigo-50 p-3 font-medium dark:bg-indigo-500/10">🎯 Prochaine étape : {resultat.prochaineEtape}</p>
          )}
        </div>
      )}
    </article>
  );
}
