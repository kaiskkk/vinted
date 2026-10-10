import { useEffect, useRef, useState } from "react";
import { DIFFICULTES, type Verdict } from "../../../shared/study";
import { SavedIndicator } from "../../components/CanvasOverlays";
import {
  CheckIcon,
  MessageQuestionIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  ShuffleIcon,
  Spinner,
  StopIcon,
  TrashIcon,
  VolumeIcon,
} from "../../components/Icons";
import { MicButton } from "../../components/MicButton";
import { btn } from "../../components/Modal";
import { useReader } from "../../components/ReadAloud";
import { ShareButton } from "../../components/ShareButton";
import { useToast } from "../../components/Toasts";
import { AutoTextarea, EmptyState, Page, PageHeader, RichText, card, input, useNiveau } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import { corrigerOral } from "../../lib/api";
import { dictationSupported } from "../../lib/dictation";
import { formatScore, shuffle, type OralDoc, type OralQuestion } from "../../lib/docs";
import { newId } from "../../lib/mapModel";
import { recordActivity } from "../../lib/serie";
import { reader, speechSupported } from "../../lib/speech";

const VOIX_KEY = "ed-oral-voix";
const LABEL = "Interrogation orale";

export const VERDICT_LOOK: Record<Verdict, { titre: string; emoji: string; points: number; className: string; chip: string }> = {
  juste: {
    titre: "Juste !",
    emoji: "✅",
    points: 1,
    className: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  partiel: {
    titre: "En partie juste",
    emoji: "🟠",
    points: 0.5,
    className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  faux: {
    titre: "Pas encore",
    emoji: "❌",
    points: 0,
    className: "border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100",
    chip: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
};

interface Reponse {
  questionId: string;
  texte: string;
  verdict: Verdict;
  retour: string;
  manque: string[];
}
interface Seance {
  ids: string[];
  index: number;
  reponses: Reponse[];
  fini: boolean;
}

const scoreOf = (reponses: Reponse[]) => reponses.reduce((n, r) => n + VERDICT_LOOK[r.verdict].points, 0);

function mention(ratio: number) {
  if (ratio >= 0.9) return { emoji: "🏆", texte: "Excellent !" };
  if (ratio >= 0.7) return { emoji: "🎉", texte: "Très bien !" };
  if (ratio >= 0.5) return { emoji: "💪", texte: "Pas mal, continue !" };
  return { emoji: "🌱", texte: "Ça va venir : refais les questions ratées." };
}

function readVoix(): boolean {
  try {
    return localStorage.getItem(VOIX_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Lit à voix haute sans afficher la barre de lecture (l'interrogation a ses propres boutons). */
const say = (texts: string[]) => reader.play(texts, LABEL, { bar: false });

export function OralView({ initial, onBack }: { initial: OralDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, savedAt } = useDoc(initial, toast.error);
  const [niveau] = useNiveau();
  const [editing, setEditing] = useState(initial.questions.length === 0);
  const [seance, setSeance] = useState<Seance | null>(null);
  const [voix, setVoixState] = useState(() => speechSupported() && readVoix());
  const [micOk] = useState(dictationSupported);
  const difficulte = DIFFICULTES.find((d) => d.value === doc.difficulte)?.label ?? "";
  const aRevoir = doc.questions.filter((q) => q.dernier && q.dernier !== "juste");

  const setVoix = (v: boolean) => {
    setVoixState(v);
    if (!v) reader.stop();
    try {
      localStorage.setItem(VOIX_KEY, v ? "1" : "0");
    } catch {
      // Préférence non mémorisée : sans gravité.
    }
  };

  // Quitter la page arrête la voix.
  useEffect(() => () => reader.stop(), []);

  const start = (ids: string[]) => {
    if (!ids.length) return;
    setSeance({ ids: shuffle(ids), index: 0, reponses: [], fini: false });
  };

  const stopSeance = () => {
    reader.stop();
    setSeance(null);
  };

  const onAnswered = (r: Reponse) => {
    update((d) => ({ ...d, questions: d.questions.map((q) => (q.id === r.questionId ? { ...q, dernier: r.verdict } : q)) }), { history: false });
    recordActivity("oral");
    setSeance((s) => (s ? { ...s, reponses: [...s.reponses, r] } : s));
  };

  const next = () => {
    reader.stop();
    if (!seance) return;
    if (seance.index + 1 < seance.ids.length) return setSeance({ ...seance, index: seance.index + 1 });
    const score = scoreOf(seance.reponses);
    update((d) => ({ ...d, seances: [...d.seances, { date: Date.now(), score, total: seance.ids.length }].slice(-30) }), { history: false });
    setSeance({ ...seance, fini: true });
  };

  const header = (
    <PageHeader
      title={doc.titre}
      subtitle={`Interrogation orale · ${doc.questions.length} question${doc.questions.length > 1 ? "s" : ""}${difficulte ? ` · ${difficulte}` : ""}`}
      onBack={seance ? stopSeance : onBack}
      backLabel={seance ? "Arrêter l'interrogation" : "Retour"}
      width="max-w-3xl"
      actions={
        <>
          <SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />
          {!seance && !editing && <ShareButton compact kind="oral" id={doc.id} titre={doc.titre} />}
          {!seance && (
            <button
              type="button"
              className={btn.icon}
              onClick={() => {
                if (editing) {
                  const questions = doc.questions.filter((q) => q.question.trim() && q.reponse.trim());
                  if (questions.length !== doc.questions.length) update((d) => ({ ...d, questions }));
                }
                setEditing((e) => !e);
              }}
              title={editing ? "Terminer" : "Modifier les questions"}
              aria-label={editing ? "Terminer" : "Modifier les questions"}
            >
              {editing ? <CheckIcon size={18} /> : <PencilIcon size={17} />}
            </button>
          )}
        </>
      }
    />
  );

  if (editing) {
    return (
      <div className="min-h-dvh">
        {header}
        <OralEditor doc={doc} update={update} onDone={() => setEditing(false)} />
      </div>
    );
  }

  if (seance) {
    const byId = new Map(doc.questions.map((q) => [q.id, q]));
    if (seance.fini) {
      return (
        <div className="min-h-dvh">
          {header}
          <Bilan seance={seance} questions={byId} onRestart={() => start(seance.ids)} onRetry={(ids) => start(ids)} onDone={stopSeance} />
        </div>
      );
    }
    const q = byId.get(seance.ids[seance.index]);
    if (!q) {
      // Question supprimée entre-temps : on passe à la suivante.
      return null;
    }
    const answered = seance.reponses.find((r) => r.questionId === q.id) ?? null;
    return (
      <div className="min-h-dvh">
        {header}
        <Page width="max-w-xl">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold tabular-nums">
              {seance.index + 1} / {seance.ids.length}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
              <div
                className="h-full rounded-full bg-linear-to-r from-pink-500 to-orange-400 transition-all"
                style={{ width: `${((seance.index + (answered ? 1 : 0)) / seance.ids.length) * 100}%` }}
              />
            </div>
            <span className="text-slate-500 tabular-nums dark:text-slate-400" title="Points">
              {formatScore(scoreOf(seance.reponses))} pt{scoreOf(seance.reponses) > 1 ? "s" : ""}
            </span>
          </div>
          <QuestionStep
            key={`${q.id}-${seance.index}`}
            question={q}
            contexte={doc.titre}
            niveau={niveau}
            voix={voix}
            micOk={micOk}
            answered={answered}
            last={seance.index + 1 >= seance.ids.length}
            onAnswered={onAnswered}
            onNext={next}
          />
        </Page>
      </div>
    );
  }

  // ---------- Accueil de l'interrogation ----------
  const last = doc.seances.at(-1);
  return (
    <div className="min-h-dvh">
      {header}
      <Page width="max-w-3xl">
        {doc.questions.length === 0 ? (
          <EmptyState
            icon={<MessageQuestionIcon size={28} />}
            title="Aucune question"
            action={
              <button type="button" className={btn.primary} onClick={() => setEditing(true)}>
                <PlusIcon size={16} /> Ajouter des questions
              </button>
            }
          >
            Écris tes questions et la réponse attendue : le site te les posera à l'oral.
          </EmptyState>
        ) : (
          <>
            <section className={`${card} p-5`}>
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-pink-500 to-orange-400 text-white shadow-lg shadow-pink-500/30">
                  <MessageQuestionIcon size={28} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">Prêt pour l'oral ?</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {voix ? "Je te pose les questions à voix haute" : "Je t'affiche les questions"}, tu réponds{" "}
                    {micOk ? "au micro (ou au clavier)" : "au clavier"}, puis l'IA te corrige.
                  </p>
                </div>
              </div>
              {doc.seances.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Tes dernières notes :</span>
                  {doc.seances.slice(-5).map((s, i) => (
                    <span key={i} className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold tabular-nums dark:bg-slate-800">
                      {formatScore(s.score)}/{s.total}
                    </span>
                  ))}
                </div>
              )}
              {speechSupported() && (
                <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60">
                  <input type="checkbox" checked={voix} onChange={(e) => setVoix(e.target.checked)} className="h-5 w-5 accent-pink-500" />
                  <VolumeIcon size={17} className="text-slate-500" />
                  <span className="text-sm font-medium">Lire les questions et les corrections à voix haute</span>
                </label>
              )}
              {!micOk && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Ce navigateur ne propose pas la dictée : tu écriras tes réponses. Pour répondre au micro, utilise Chrome, Edge ou Safari.
                </p>
              )}
            </section>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => start(doc.questions.map((q) => q.id))}
                className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-pink-500 to-orange-400 px-5 text-lg font-semibold text-white shadow-xl shadow-pink-500/30 transition hover:brightness-110 active:scale-[0.99]"
              >
                <ShuffleIcon size={18} /> Commencer l'interrogation · {doc.questions.length} question{doc.questions.length > 1 ? "s" : ""}
              </button>
              {aRevoir.length > 0 && (
                <button type="button" className={`${btn.secondary} w-full`} onClick={() => start(aRevoir.map((q) => q.id))}>
                  <RefreshIcon size={15} /> Revoir les questions ratées ({aRevoir.length})
                </button>
              )}
              {last && (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Dernière interrogation : {formatScore(last.score)}/{last.total}
                </p>
              )}
            </div>

            <section className="mt-8" aria-labelledby="questions-oral">
              <h2 id="questions-oral" className="mb-2 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Les questions
              </h2>
              <ol className="space-y-2">
                {doc.questions.map((q, i) => (
                  <li key={q.id} className={`${card} p-3`}>
                    <details>
                      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-pink-100 text-xs font-bold text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 font-medium">{q.question}</span>
                        {q.dernier && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${VERDICT_LOOK[q.dernier].chip}`}>
                            {VERDICT_LOOK[q.dernier].emoji}
                          </span>
                        )}
                      </summary>
                      <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                        <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Réponse attendue</p>
                        <RichText text={q.reponse} className="mt-1" />
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </Page>
    </div>
  );
}

// ---------- Une question : réponse au micro ou au clavier, puis correction ----------

function QuestionStep({
  question: q,
  contexte,
  niveau,
  voix,
  micOk,
  answered,
  last,
  onAnswered,
  onNext,
}: {
  question: OralQuestion;
  contexte: string;
  niveau: ReturnType<typeof useNiveau>[0];
  voix: boolean;
  micOk: boolean;
  answered: Reponse | null;
  last: boolean;
  onAnswered: (r: Reponse) => void;
  onNext: () => void;
}) {
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfGrade, setSelfGrade] = useState(false);
  const [listening, setListening] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const r = useReader();
  const speaking = r.status !== "idle" && r.label === LABEL;

  useEffect(() => () => controller.current?.abort(), []);

  // La question est lue dès qu'elle s'affiche ; la correction dès qu'elle arrive.
  useEffect(() => {
    if (voix && !answered) say([q.question]);
  }, [voix, q.question, answered]);
  useEffect(() => {
    if (!voix || !answered) return;
    const look = VERDICT_LOOK[answered.verdict];
    say([`${look.titre} ${answered.retour}`, ...(answered.verdict !== "juste" ? [`La réponse attendue : ${q.reponse}`] : [])]);
  }, [voix, answered, q.reponse]);

  const finish = (verdict: Verdict, retour: string, manque: string[] = []) =>
    onAnswered({ questionId: q.id, texte: texte.trim(), verdict, retour, manque });

  const valider = async () => {
    const reponse = texte.trim();
    if (!reponse || busy) return;
    reader.stop();
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError(null);
    try {
      const res = await corrigerOral({ question: q.question, attendu: q.reponse, points: q.points, reponse, contexte }, niveau, c.signal);
      if (c.signal.aborted) return;
      finish(res.verdict, res.retour, res.manque);
    } catch (err) {
      if (c.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
      setError(err instanceof Error ? err.message : "La correction n'a pas marché.");
    } finally {
      if (controller.current === c) setBusy(false);
    }
  };

  if (answered) {
    const look = VERDICT_LOOK[answered.verdict];
    return (
      <div className="mt-5 space-y-4">
        <p className="text-lg leading-snug font-semibold">{q.question}</p>
        <section className={`animate-pop rounded-2xl border-2 p-4 ${look.className}`} role="status">
          <p className="text-lg font-bold">
            <span aria-hidden="true">{look.emoji}</span> {look.titre}
          </p>
          <RichText text={answered.retour} className="mt-1" />
          {answered.manque.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold">Ce qu'il manquait :</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {answered.manque.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
        {answered.texte && (
          <section className={`${card} p-4`}>
            <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Ta réponse</p>
            <p className="mt-1 whitespace-pre-line text-slate-700 dark:text-slate-200">{answered.texte}</p>
          </section>
        )}
        <section className={`${card} p-4`}>
          <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Réponse attendue</p>
          <RichText text={q.reponse} className="mt-1" />
          {q.points.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {q.points.map((p, i) => (
                <span
                  key={i}
                  className="rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-500/15 dark:text-pink-300"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </section>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNext}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-pink-500 to-orange-400 px-5 font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110 active:scale-[0.98]"
          >
            {last ? "Voir mon bilan" : "Question suivante →"}
          </button>
          {voix && (
            <button type="button" className={btn.secondary} onClick={() => (speaking ? reader.stop() : say([answered.retour]))}>
              {speaking ? <StopIcon size={15} /> : <VolumeIcon size={16} />} {speaking ? "Arrêter" : "Réécouter"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <section className={`${card} animate-pop p-5`}>
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 text-xl leading-snug font-semibold text-balance">{q.question}</p>
          {speechSupported() && (
            <button
              type="button"
              className={`${btn.icon} -mt-1 -mr-1`}
              onClick={() => (speaking ? reader.stop() : say([q.question]))}
              aria-label={speaking ? "Arrêter la lecture" : "Réécouter la question"}
              title={speaking ? "Arrêter la lecture" : "Réécouter la question"}
            >
              {speaking ? <StopIcon size={15} /> : <VolumeIcon size={17} />}
            </button>
          )}
        </div>
      </section>

      {selfGrade ? (
        <section className={`${card} p-4`}>
          <p className="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400">Réponse attendue</p>
          <RichText text={q.reponse} className="mt-1" />
          <p className="mt-4 text-sm font-semibold">Et toi, tu avais répondu comment ?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["juste", "partiel", "faux"] as Verdict[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`min-h-12 rounded-xl px-2 text-sm font-semibold transition active:scale-95 ${VERDICT_LOOK[v].chip}`}
                onClick={() =>
                  finish(
                    v,
                    v === "juste"
                      ? "Tu as jugé ta réponse juste. Bravo !"
                      : v === "partiel"
                        ? "Tu as jugé ta réponse en partie juste."
                        : "Tu as jugé ta réponse fausse : relis bien la réponse attendue.",
                  )
                }
              >
                {VERDICT_LOOK[v].emoji} {v === "juste" ? "Juste" : v === "partiel" ? "À moitié" : "Faux"}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          {micOk && (
            <div className="flex flex-col items-center gap-2 py-2">
              <MicButton
                big
                value={texte}
                onChange={setTexte}
                max={4000}
                label="Répondre au micro"
                onListening={(on) => {
                  setListening(on);
                  // On n'écoute pas sa propre voix : la lecture s'arrête quand l'élève parle.
                  if (on) reader.stop();
                }}
              />
              <p className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
                {listening
                  ? "Je t'écoute… touche le micro quand tu as fini."
                  : texte
                    ? "Touche le micro pour ajouter quelque chose."
                    : "Touche le micro et réponds à voix haute."}
              </p>
            </div>
          )}
          <label className="block">
            <span className="text-sm font-semibold">Ta réponse{micOk ? " (tu peux la corriger au clavier)" : ""}</span>
            <AutoTextarea
              value={texte}
              onChange={(v) => setTexte(v.slice(0, 4000))}
              minRows={3}
              placeholder={micOk ? "Ce que tu dis au micro s'écrit ici…" : "Écris ta réponse…"}
              className={`${input} mt-1.5 py-2.5`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void valider();
                }
              }}
            />
          </label>
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <p>{error}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={btn.secondary} onClick={() => void valider()}>
                  <RefreshIcon size={14} /> Réessayer
                </button>
                <button type="button" className={btn.secondary} onClick={() => setSelfGrade(true)}>
                  Me corriger moi-même
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void valider()}
              disabled={!texte.trim() || busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl sm:w-auto sm:flex-1 bg-linear-to-r from-pink-500 to-orange-400 px-5 font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Spinner className="h-4 w-4" /> : <CheckIcon size={17} />} {busy ? "L'IA écoute ta réponse…" : "Valider ma réponse"}
            </button>
            <button
              type="button"
              className={`${btn.secondary} w-full sm:w-auto`}
              disabled={busy}
              onClick={() => finish("faux", "Ce n'est pas grave : lis bien la réponse attendue, cette question reviendra.")}
            >
              Je ne sais pas
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Bilan ----------

function Bilan({
  seance,
  questions,
  onRestart,
  onRetry,
  onDone,
}: {
  seance: Seance;
  questions: Map<string, OralQuestion>;
  onRestart: () => void;
  onRetry: (ids: string[]) => void;
  onDone: () => void;
}) {
  const score = scoreOf(seance.reponses);
  const total = seance.ids.length;
  const m = mention(total ? score / total : 0);
  const rates = seance.reponses.filter((r) => r.verdict !== "juste").map((r) => r.questionId);
  return (
    <Page width="max-w-xl">
      <section className={`${card} animate-pop p-6 text-center`}>
        <p className="text-4xl" aria-hidden="true">
          {m.emoji}
        </p>
        <p className="mt-2 text-3xl font-extrabold tabular-nums">
          {formatScore(score)}/{total}
        </p>
        <p className="mt-1 font-semibold">{m.texte}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {rates.length > 0 && (
            <button type="button" className={btn.primary} onClick={() => onRetry(rates)}>
              <RefreshIcon size={15} /> Refaire les questions ratées ({rates.length})
            </button>
          )}
          <button type="button" className={btn.secondary} onClick={onRestart}>
            <ShuffleIcon size={15} /> Tout recommencer
          </button>
          <button type="button" className={btn.secondary} onClick={onDone}>
            <CheckIcon size={15} /> Terminer
          </button>
        </div>
      </section>
      <ol className="mt-5 space-y-2">
        {seance.reponses.map((r, i) => {
          const q = questions.get(r.questionId);
          if (!q) return null;
          const look = VERDICT_LOOK[r.verdict];
          return (
            <li key={`${r.questionId}-${i}`} className={`${card} p-3`}>
              <div className="flex items-start gap-2">
                <span aria-hidden="true">{look.emoji}</span>
                <p className="min-w-0 flex-1 font-medium">{q.question}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${look.chip}`}>{look.titre}</span>
              </div>
              {r.verdict !== "juste" && (
                <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-sm dark:bg-slate-800/60">
                  <span className="font-semibold">Réponse attendue : </span>
                  {q.reponse}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Page>
  );
}

// ---------- Modifier les questions ----------

function OralEditor({
  doc,
  update,
  onDone,
}: {
  doc: OralDoc;
  update: (fn: (d: OralDoc) => OralDoc, opts?: { key?: string }) => void;
  onDone: () => void;
}) {
  const change = (id: string, patch: Partial<OralQuestion>, key: string) =>
    update((d) => ({ ...d, questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }), { key: `${id}-${key}` });
  const add = () => update((d) => ({ ...d, questions: [...d.questions, { id: newId(), question: "", reponse: "", points: [] }] }));
  const remove = (id: string) => update((d) => ({ ...d, questions: d.questions.filter((q) => q.id !== id) }));
  return (
    <Page width="max-w-3xl">
      <label className="block text-sm font-semibold">
        Titre
        <input
          value={doc.titre}
          onChange={(e) => update((d) => ({ ...d, titre: e.target.value.slice(0, 140) }), { key: "titre" })}
          className={`${input} mt-1.5 h-12 font-normal`}
        />
      </label>
      <ol className="mt-5 space-y-3">
        {doc.questions.map((q, i) => (
          <li key={q.id} className={`${card} space-y-3 p-4`}>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-100 text-sm font-bold text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-semibold">Question {i + 1}</span>
              <button
                type="button"
                className={`${btn.icon} hover:text-red-600`}
                onClick={() => remove(q.id)}
                aria-label={`Supprimer la question ${i + 1}`}
              >
                <TrashIcon size={16} />
              </button>
            </div>
            <AutoTextarea
              value={q.question}
              onChange={(v) => change(q.id, { question: v.slice(0, 500) }, "q")}
              minRows={1}
              placeholder="La question"
              aria-label={`Question ${i + 1}`}
              className={`${input} py-2.5`}
            />
            <AutoTextarea
              value={q.reponse}
              onChange={(v) => change(q.id, { reponse: v.slice(0, 1500) }, "r")}
              minRows={2}
              placeholder="La réponse attendue"
              aria-label={`Réponse attendue ${i + 1}`}
              className={`${input} py-2.5`}
            />
            <input
              value={q.points.join(", ")}
              onChange={(e) =>
                change(
                  q.id,
                  {
                    points: e.target.value
                      .split(",")
                      .map((p) => p.trimStart())
                      .slice(0, 5),
                  },
                  "p",
                )
              }
              onBlur={() => change(q.id, { points: q.points.map((p) => p.trim()).filter(Boolean) }, "p")}
              placeholder="Mots clés attendus, séparés par des virgules (facultatif)"
              aria-label={`Mots clés attendus ${i + 1}`}
              className={`${input} h-11 text-sm`}
            />
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} onClick={add}>
          <PlusIcon size={16} /> Ajouter une question
        </button>
        <button type="button" className={btn.primary} onClick={onDone}>
          <CheckIcon size={16} /> Terminer
        </button>
      </div>
    </Page>
  );
}
