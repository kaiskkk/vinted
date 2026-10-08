import { useCallback, useEffect, useMemo, useState } from "react";
import { SavedIndicator } from "../../components/CanvasOverlays";
import {
  CardsIcon,
  CheckIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  ShuffleIcon,
  TrashIcon,
  TrophyIcon,
  XIcon,
} from "../../components/Icons";
import { btn } from "../../components/Modal";
import { SimplifyButton } from "../../components/Simplify";
import { useToast } from "../../components/Toasts";
import { AutoTextarea, Page, PageHeader, RichText, card, input } from "../../components/ui";
import { openDoc } from "../../hooks/useHashRoute";
import { useDoc } from "../../hooks/useDoc";
import { newCard, saveDoc, shuffle, touchClasseur, type FlashcardsDoc, type QuizDoc, type QuizQuestion } from "../../lib/docs";
import { newId } from "../../lib/mapModel";
import { recordActivity } from "../../lib/serie";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const DIFF_LABEL = { facile: "Facile", moyen: "Moyen", difficile: "Difficile" } as const;

type Run = { order: string[]; index: number; answers: Record<string, number>; complete: boolean };
const newRun = (ids: string[]): Run => ({ order: ids, index: 0, answers: {}, complete: true });

function verdict(pct: number) {
  if (pct >= 90) return { titre: "Excellent !", texte: "Tu maîtrises ce chapitre. 🎉" };
  if (pct >= 70) return { titre: "Très bien !", texte: "Encore quelques détails à revoir." };
  if (pct >= 50) return { titre: "Pas mal !", texte: "Revois tes erreurs puis refais le quiz." };
  return { titre: "Courage !", texte: "Relis ta fiche, puis retente les questions ratées." };
}

export function QuizView({ initial, onBack }: { initial: QuizDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, savedAt } = useDoc(initial, toast.error);
  const [editing, setEditing] = useState(initial.questions.length === 0);
  const [run, setRun] = useState<Run>(() => newRun(initial.questions.map((q) => q.id)));
  const byId = useMemo(() => new Map(doc.questions.map((q) => [q.id, q])), [doc.questions]);
  const order = run.order.filter((id) => byId.has(id));
  const finished = order.length > 0 && run.index >= order.length;
  const current = finished ? undefined : byId.get(order[run.index]);
  const answer = current ? run.answers[current.id] : undefined;
  const best = doc.tentatives.reduce((m, t) => Math.max(m, Math.round((t.score / t.total) * 100)), 0);

  const choose = useCallback(
    (i: number) => {
      if (!current || answer !== undefined) return;
      setRun((r) => ({ ...r, answers: { ...r.answers, [current.id]: i } }));
    },
    [current, answer],
  );

  const next = useCallback(() => {
    if (answer === undefined) return;
    const last = run.index + 1 >= order.length;
    if (last) recordActivity("quiz");
    if (last && run.complete) {
      const score = order.filter((id) => run.answers[id] === byId.get(id)?.bonne).length;
      update((d) => ({ ...d, tentatives: [...d.tentatives, { date: Date.now(), score, total: order.length }].slice(-30) }), { history: false });
    }
    setRun((r) => ({ ...r, index: r.index + 1 }));
    window.scrollTo({ top: 0 });
  }, [answer, run, order, byId, update]);

  // Clavier : 1-4 ou A-D pour répondre, Entrée pour continuer.
  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => {
      // Un bouton qui a le focus réagit déjà à Entrée tout seul.
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, button")) return;
      const k = e.key.toUpperCase();
      const n = /^[1-6]$/.test(k) ? Number(k) - 1 : LETTERS.indexOf(k);
      if (current && n >= 0 && n < current.choix.length) choose(n);
      else if (e.key === "Enter" && answer !== undefined) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, current, answer, choose, next]);

  const finishEditing = () => {
    const { questions, error } = cleanQuestions(doc.questions);
    if (error) return toast.error(error);
    update((d) => ({ ...d, questions }));
    setRun(newRun(questions.map((q) => q.id)));
    setEditing(false);
  };

  const restart = (ids: string[], complete: boolean) => {
    setRun({ ...newRun(shuffle(ids)), complete });
    window.scrollTo({ top: 0 });
  };

  const missed = order.filter((id) => run.answers[id] !== byId.get(id)?.bonne);

  const errorsToCards = () => {
    const deck: FlashcardsDoc = {
      id: newId(),
      type: "flashcards",
      titre: `Erreurs — ${doc.titre}`.slice(0, 140),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(doc.classeurId ? { classeurId: doc.classeurId } : {}),
      cartes: missed.map((id) => {
        const q = byId.get(id)!;
        return newCard(q.question, [q.choix[q.bonne], q.explication].filter(Boolean).join("\n\n"));
      }),
    };
    try {
      saveDoc(deck);
      touchClasseur(doc.classeurId);
      toast.success(`Paquet de ${deck.cartes.length} flashcards créé avec tes erreurs.`, { label: "Ouvrir", onClick: () => openDoc(deck.id) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    }
  };

  const header = (
    <PageHeader
      title={doc.titre}
      subtitle={`Quiz · ${doc.questions.length} questions · ${DIFF_LABEL[doc.difficulte]}`}
      onBack={onBack}
      width="max-w-3xl"
      actions={
        <>
          <SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />
          <button
            type="button"
            className={btn.icon}
            onClick={() => (editing ? finishEditing() : setEditing(true))}
            title={editing ? "Terminer et jouer" : "Modifier les questions"}
            aria-label={editing ? "Terminer et jouer" : "Modifier les questions"}
          >
            {editing ? <CheckIcon size={18} /> : <PencilIcon size={17} />}
          </button>
        </>
      }
    />
  );

  if (editing) {
    return (
      <div className="min-h-dvh">
        {header}
        <QuizEditor doc={doc} update={update} onDone={finishEditing} />
      </div>
    );
  }

  if (finished) {
    const score = order.length - missed.length;
    const pct = Math.round((score / order.length) * 100);
    const v = verdict(pct);
    return (
      <div className="min-h-dvh">
        {header}
        <Page width="max-w-3xl">
          <section className={`${card} animate-pop p-6 text-center`}>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
              <TrophyIcon size={30} />
            </span>
            <p className="mt-4 text-4xl font-extrabold tabular-nums">
              {score} / {order.length}
            </p>
            <p className="mt-1 text-lg font-semibold">{v.titre}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {v.texte} {run.complete && best > 0 && `Meilleur score : ${best} %.`}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {missed.length > 0 && (
                <button type="button" className={btn.primary} onClick={() => restart(missed, false)}>
                  <RefreshIcon size={15} /> Refaire les {missed.length} ratée{missed.length > 1 ? "s" : ""}
                </button>
              )}
              <button
                type="button"
                className={btn.secondary}
                onClick={() =>
                  restart(
                    doc.questions.map((q) => q.id),
                    true,
                  )
                }
              >
                <ShuffleIcon size={15} /> Recommencer tout
              </button>
              {missed.length > 0 && (
                <button type="button" className={btn.secondary} onClick={errorsToCards}>
                  <CardsIcon size={15} /> Flashcards de mes erreurs
                </button>
              )}
            </div>
          </section>

          {missed.length > 0 && (
            <section className="mt-8" aria-labelledby="ratees">
              <h2 id="ratees" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Questions ratées ({missed.length})
              </h2>
              <ul className="space-y-3">
                {missed.map((id) => {
                  const q = byId.get(id)!;
                  const mine = run.answers[id];
                  return (
                    <li key={id} className={`${card} p-4`}>
                      <RichText text={q.question} className="font-semibold" />
                      <p className="mt-2 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                        <XIcon size={16} className="mt-0.5 shrink-0" /> Ta réponse : {q.choix[mine] ?? "—"}
                      </p>
                      <p className="mt-1 flex items-start gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckIcon size={16} className="mt-0.5 shrink-0" /> Bonne réponse : {q.choix[q.bonne]}
                      </p>
                      {q.explication && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                          <RichText text={q.explication} />
                          <SimplifyButton
                            text={`${q.question}\nRéponse : ${q.choix[q.bonne]}\n${q.explication}`}
                            contexte={doc.titre}
                            className="mt-1 -ml-2"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </Page>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-dvh">
        {header}
        <Page width="max-w-3xl">
          <p className="text-center text-slate-500">Ce quiz n'a pas encore de question.</p>
        </Page>
      </div>
    );
  }

  const answered = answer !== undefined;
  const correct = answered && answer === current.bonne;
  const pct = Math.round((run.index / order.length) * 100);

  return (
    <div className="min-h-dvh">
      {header}
      <Page width="max-w-3xl">
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 tabular-nums dark:text-slate-200">
            Question {run.index + 1} / {order.length}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
            <div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <section key={current.id} className="mt-5 animate-slide-up">
          <RichText text={current.question} className="text-lg leading-snug font-semibold sm:text-xl" />
          <ul className="mt-5 space-y-2.5">
            {current.choix.map((c, i) => {
              const isRight = i === current.bonne;
              const isMine = i === answer;
              const state = !answered ? "idle" : isRight ? "right" : isMine ? "wrong" : "dim";
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    disabled={answered}
                    aria-pressed={isMine}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                      state === "idle"
                        ? "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-500/5"
                        : state === "right"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15"
                          : state === "wrong"
                            ? "animate-[shake_0.35s] border-red-500 bg-red-50 dark:bg-red-500/15"
                            : "border-slate-200 opacity-55 dark:border-slate-800"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        state === "right"
                          ? "bg-emerald-500 text-white"
                          : state === "wrong"
                            ? "bg-red-500 text-white"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {state === "right" ? (
                        <CheckIcon size={16} strokeWidth={3} />
                      ) : state === "wrong" ? (
                        <XIcon size={16} strokeWidth={3} />
                      ) : (
                        LETTERS[i]
                      )}
                    </span>
                    <span className="min-w-0 flex-1">{c}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {answered && (
            <div
              className={`mt-5 animate-slide-up rounded-2xl p-4 ${correct ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"}`}
              role="status"
            >
              <p className={`font-bold ${correct ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                {correct ? "Bonne réponse ! 🎉" : `Raté : la bonne réponse était « ${current.choix[current.bonne]} ».`}
              </p>
              {current.explication && <RichText text={current.explication} className="mt-1.5 text-sm text-slate-700 dark:text-slate-200" />}
              {current.explication && (
                <SimplifyButton
                  text={`${current.question}\nRéponse : ${current.choix[current.bonne]}\n${current.explication}`}
                  contexte={doc.titre}
                  className="mt-1 -ml-2"
                />
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={next}
              disabled={!answered}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 px-6 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none sm:w-auto"
            >
              {run.index + 1 >= order.length ? "Voir mon score" : "Question suivante"} <ChevronRightIcon size={18} />
            </button>
          </div>
        </section>
      </Page>
    </div>
  );
}

// ---------- Édition des questions ----------

/** Retire les réponses vides ; renvoie un message si une question est incomplète. */
function cleanQuestions(questions: QuizQuestion[]): { questions: QuizQuestion[]; error?: string } {
  if (!questions.length) return { questions, error: "Ajoute au moins une question." };
  const out: QuizQuestion[] = [];
  for (const [n, q] of questions.entries()) {
    const kept = q.choix.map((c, i) => ({ c: c.trim(), i })).filter((x) => x.c);
    const bonne = kept.findIndex((x) => x.i === q.bonne);
    if (!q.question.trim() || kept.length < 2 || bonne < 0) {
      return { questions, error: `Question ${n + 1} : il faut un énoncé, au moins 2 réponses, et la bonne réponse remplie.` };
    }
    out.push({ ...q, question: q.question.trim(), choix: kept.map((x) => x.c), bonne });
  }
  return { questions: out };
}

function QuizEditor({
  doc,
  update,
  onDone,
}: {
  doc: QuizDoc;
  update: (fn: (d: QuizDoc) => QuizDoc, opts?: { key?: string }) => void;
  onDone: () => void;
}) {
  const setQ = (id: string, fn: (q: QuizQuestion) => QuizQuestion, key?: string) =>
    update((d) => ({ ...d, questions: d.questions.map((q) => (q.id === id ? fn(q) : q)) }), { key });

  return (
    <Page width="max-w-3xl">
      <p className="text-sm text-slate-600 dark:text-slate-300">Corrige ou ajoute des questions. Coche la bonne réponse de chacune.</p>
      <ol className="mt-4 space-y-4">
        {doc.questions.map((q, n) => (
          <li key={q.id} className={`${card} p-4`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Question {n + 1}</span>
              <span className="flex-1" />
              <button
                type="button"
                className={`${btn.icon} hover:text-red-600`}
                onClick={() => update((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== q.id) }))}
                aria-label={`Supprimer la question ${n + 1}`}
              >
                <TrashIcon size={16} />
              </button>
            </div>
            <AutoTextarea
              value={q.question}
              onChange={(v) => setQ(q.id, (x) => ({ ...x, question: v }), `q-${q.id}`)}
              placeholder="Énoncé de la question"
              aria-label="Énoncé"
              className={`${input} mt-2 py-2.5 font-medium`}
            />
            <ul className="mt-3 space-y-2">
              {q.choix.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center" title="Bonne réponse">
                    <input
                      type="radio"
                      name={`bonne-${q.id}`}
                      checked={q.bonne === i}
                      onChange={() => setQ(q.id, (x) => ({ ...x, bonne: i }))}
                      className="h-5 w-5 accent-emerald-600"
                      aria-label={`Réponse ${LETTERS[i]} correcte`}
                    />
                  </label>
                  <input
                    value={c}
                    onChange={(e) => setQ(q.id, (x) => ({ ...x, choix: x.choix.map((y, k) => (k === i ? e.target.value : y)) }), `c-${q.id}-${i}`)}
                    placeholder={`Réponse ${LETTERS[i]}`}
                    aria-label={`Réponse ${LETTERS[i]}`}
                    className={`${input} h-11`}
                  />
                  <button
                    type="button"
                    className={btn.icon}
                    disabled={q.choix.length <= 2}
                    onClick={() =>
                      setQ(q.id, (x) => {
                        const choix = x.choix.filter((_, k) => k !== i);
                        const bonne = x.bonne === i ? 0 : x.bonne > i ? x.bonne - 1 : x.bonne;
                        return { ...x, choix, bonne };
                      })
                    }
                    aria-label={`Retirer la réponse ${LETTERS[i]}`}
                  >
                    <XIcon size={15} />
                  </button>
                </li>
              ))}
            </ul>
            {q.choix.length < 6 && (
              <button
                type="button"
                className={`${btn.secondary} mt-2 border-dashed`}
                onClick={() => setQ(q.id, (x) => ({ ...x, choix: [...x.choix, ""] }))}
              >
                <PlusIcon size={14} /> Ajouter une réponse
              </button>
            )}
            <AutoTextarea
              value={q.explication}
              onChange={(v) => setQ(q.id, (x) => ({ ...x, explication: v }), `e-${q.id}`)}
              placeholder="Explication de la correction (facultatif)"
              aria-label="Explication"
              className={`${input} mt-3 py-2.5 text-sm`}
            />
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className={`${btn.secondary} border-dashed sm:flex-1`}
          onClick={() =>
            update((d) => ({ ...d, questions: [...d.questions, { id: newId(), question: "", choix: ["", "", "", ""], bonne: 0, explication: "" }] }))
          }
        >
          <PlusIcon size={15} /> Ajouter une question
        </button>
        <button type="button" className={btn.primary} onClick={onDone}>
          <CheckIcon size={16} /> Terminer et jouer
        </button>
      </div>
    </Page>
  );
}
