import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShareButton } from "../../components/ShareButton";
import { ListenButton } from "../../components/ReadAloud";
import { docSegments } from "../../lib/docSpeech";
import { SavedIndicator } from "../../components/CanvasOverlays";
import { CheckIcon, MessageQuestionIcon, PencilIcon, PlusIcon, RefreshIcon, RotateIcon, ShuffleIcon, TrashIcon, XIcon } from "../../components/Icons";
import { Modal, btn } from "../../components/Modal";
import { SimplifyButton } from "../../components/Simplify";
import { useToast } from "../../components/Toasts";
import { AutoTextarea, Page, PageHeader, RichText, card, input } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import { openDoc } from "../../hooks/useHashRoute";
import { newCard, oralFromFlashcards, saveDoc, shuffle, touchClasseur, type FlashcardsDoc } from "../../lib/docs";
import { plural } from "../../lib/format";
import { answer, deckStats, isDue, sessionQueue } from "../../lib/leitner";
import { recordActivity } from "../../lib/serie";

type Session = { queue: string[]; index: number; known: number; again: number; requeued: Record<string, number> };
const BOXES = ["Nouvelles", "Boîte 1", "Boîte 2", "Boîte 3", "Boîte 4", "Maîtrisées"];
const nextReview = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export function FlashcardsView({ initial, onBack }: { initial: FlashcardsDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, savedAt } = useDoc(initial, toast.error);
  const [editing, setEditing] = useState(initial.cartes.length === 0);
  const [session, setSession] = useState<Session | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [now, setNow] = useState(Date.now);
  const cardRef = useRef<HTMLButtonElement>(null);
  const stats = useMemo(() => deckStats(doc.cartes, now), [doc.cartes, now]);
  const byId = useMemo(() => new Map(doc.cartes.map((c) => [c.id, c])), [doc.cartes]);

  const start = (toutes: boolean) => {
    const queue = toutes ? shuffle(doc.cartes.map((c) => c.id)) : sessionQueue(doc.cartes, Date.now());
    if (!queue.length) return;
    setSession({ queue, index: 0, known: 0, again: 0, requeued: {} });
    setFlipped(false);
  };

  const current = session && session.index < session.queue.length ? byId.get(session.queue[session.index]) : undefined;

  const grade = useCallback(
    (knew: boolean) => {
      if (!session || !current || !flipped) return;
      recordActivity("flashcards");
      update((d) => ({ ...d, cartes: d.cartes.map((c) => (c.id === current.id ? answer(c, knew) : c)) }), { history: false });
      setSession((s) => {
        if (!s) return s;
        const times = s.requeued[current.id] ?? 0;
        // Une carte ratée repasse en fin de séance (deux fois au plus).
        const requeue = !knew && times < 2;
        return {
          ...s,
          index: s.index + 1,
          known: s.known + (knew ? 1 : 0),
          again: s.again + (knew ? 0 : 1),
          queue: requeue ? [...s.queue, current.id] : s.queue,
          requeued: requeue ? { ...s.requeued, [current.id]: times + 1 } : s.requeued,
        };
      });
      setFlipped(false);
    },
    [session, current, flipped, update],
  );

  // La carte garde le focus : Espace ou Entrée la retournent directement.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [current?.id, session?.index]);

  // Clavier : Espace pour retourner, ← à revoir, → je sais.
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, textarea, select")) return;
      // Sur un bouton, Espace et Entrée le déclenchent déjà.
      if ((e.key === " " || e.key === "Enter") && !target?.closest("button")) {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight" || e.key === "2") grade(true);
      else if (e.key === "ArrowLeft" || e.key === "1") grade(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, grade]);

  const header = (
    <PageHeader
      title={doc.titre}
      subtitle={`Flashcards · ${plural(doc.cartes.length, "carte")}`}
      onBack={session ? () => (setSession(null), setNow(Date.now())) : onBack}
      backLabel={session ? "Arrêter la séance" : "Retour"}
      width="max-w-3xl"
      actions={
        <>
          <SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />
          {!session && !editing && <ListenButton compact texts={() => docSegments(doc)} label={`Flashcards : ${doc.titre}`} />}
          {!session && !editing && <ShareButton compact kind="flashcards" id={doc.id} titre={doc.titre} />}
          {!session && (
            <button
              type="button"
              className={btn.icon}
              onClick={() => {
                if (editing) {
                  const cartes = doc.cartes.filter((c) => c.recto.trim() || c.verso.trim());
                  if (cartes.length !== doc.cartes.length) update((d) => ({ ...d, cartes }));
                }
                setEditing((e) => !e);
              }}
              title={editing ? "Terminer" : "Modifier les cartes"}
              aria-label={editing ? "Terminer" : "Modifier les cartes"}
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
        <DeckEditor doc={doc} update={update} onDone={() => setEditing(false)} />
      </div>
    );
  }

  // ---------- Séance ----------
  if (session) {
    if (!current) {
      return (
        <div className="min-h-dvh">
          {header}
          <Page width="max-w-xl">
            <section className={`${card} animate-pop p-6 text-center`}>
              <p className="text-4xl" aria-hidden="true">
                {session.again === 0 ? "🏆" : "💪"}
              </p>
              <p className="mt-2 text-xl font-bold">Séance terminée !</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {plural(session.known, "carte sue", "cartes sues")} · {plural(session.again, "carte à revoir", "cartes à revoir")}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  className={btn.primary}
                  onClick={() => {
                    setSession(null);
                    setNow(Date.now());
                  }}
                >
                  <CheckIcon size={16} /> Voir ma progression
                </button>
                <button type="button" className={btn.secondary} onClick={() => start(true)}>
                  <ShuffleIcon size={15} /> Tout revoir
                </button>
              </div>
            </section>
          </Page>
        </div>
      );
    }
    const done = session.index;
    const total = session.queue.length;
    return (
      <div className="min-h-dvh">
        {header}
        <Page width="max-w-xl">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold tabular-nums">
              {Math.min(done + 1, total)} / {total}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
              <div
                className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 transition-all"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            <span className="text-emerald-600 tabular-nums dark:text-emerald-400" title="Sues">
              ✓ {session.known}
            </span>
            <span className="text-amber-600 tabular-nums dark:text-amber-400" title="À revoir">
              ↺ {session.again}
            </span>
            <ListenButton
              compact
              className="-my-2"
              texts={() => [flipped ? current.verso : current.recto]}
              label={flipped ? "Réponse de la carte" : "Question de la carte"}
            />
          </div>

          <button
            type="button"
            ref={cardRef}
            key={`${current.id}-${done}`}
            onClick={() => setFlipped((f) => !f)}
            className={`flip mt-5 block w-full animate-pop text-left ${flipped ? "is-flipped" : ""}`}
            aria-label={flipped ? "Réponse affichée. Touche pour revoir la question" : "Touche pour voir la réponse"}
          >
            <div className="flip-inner">
              <div className="flip-face flex min-h-72 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-violet-500/10 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-semibold tracking-wider text-violet-600 uppercase dark:text-violet-300">Question</span>
                <div className="flex flex-1 items-center justify-center py-4 text-center">
                  <RichText text={current.recto} className="text-xl leading-snug font-semibold sm:text-2xl" />
                </div>
                <span className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <RotateIcon size={14} /> Touche la carte pour la retourner
                </span>
              </div>
              <div className="flip-face flip-back flex min-h-72 flex-col rounded-3xl border border-violet-300 bg-linear-to-br from-violet-50 to-fuchsia-50 p-6 shadow-xl shadow-violet-500/15 dark:border-violet-500/40 dark:from-violet-950/60 dark:to-fuchsia-950/40">
                <span className="text-xs font-semibold tracking-wider text-fuchsia-600 uppercase dark:text-fuchsia-300">Réponse</span>
                <div className="flex flex-1 items-center justify-center py-4 text-center">
                  <RichText text={current.verso} className="text-lg leading-relaxed" />
                </div>
              </div>
            </div>
          </button>

          <div
            className={`mt-5 grid grid-cols-2 gap-3 transition ${flipped ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={!flipped}
          >
            <button
              type="button"
              onClick={() => grade(false)}
              tabIndex={flipped ? 0 : -1}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-amber-400 bg-amber-50 font-semibold text-amber-800 transition active:scale-[0.98] dark:bg-amber-500/10 dark:text-amber-200"
            >
              <RefreshIcon size={17} /> À revoir
            </button>
            <button
              type="button"
              onClick={() => grade(true)}
              tabIndex={flipped ? 0 : -1}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 font-semibold text-white shadow-lg shadow-emerald-500/25 transition active:scale-[0.98]"
            >
              <CheckIcon size={18} strokeWidth={2.5} /> Je sais
            </button>
          </div>
          {flipped && (
            <div className="mt-3 flex justify-center">
              <SimplifyButton text={`${current.recto}\n${current.verso}`} contexte={doc.titre} />
            </div>
          )}
          <p className="mt-4 hidden text-center text-xs text-slate-400 sm:block">Clavier : Espace pour retourner · ← à revoir · → je sais</p>
        </Page>
      </div>
    );
  }

  // ---------- Accueil du paquet : progression ----------
  const soonest = doc.cartes.filter((c) => !isDue(c, now)).reduce((m, c) => Math.min(m, c.prochaine), Infinity);
  const counts = BOXES.map((_, b) => doc.cartes.filter((c) => (b === 0 ? c.revues === 0 : c.revues > 0 && c.boite === b)).length);
  const relearn = doc.cartes.filter((c) => c.revues > 0 && c.boite === 0).length;
  counts[0] += relearn;

  return (
    <div className="min-h-dvh">
      {header}
      <Page width="max-w-3xl">
        <section className={`${card} p-5`}>
          <div className="flex items-center gap-5">
            <ProgressRing value={stats.progression} />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{stats.maitrisees === stats.total && stats.total > 0 ? "Paquet maîtrisé !" : "Ta progression"}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {plural(stats.maitrisees, "carte maîtrisée", "cartes maîtrisées")} sur {stats.total}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Nouvelles" value={stats.nouvelles} tone="text-violet-600 dark:text-violet-300" />
            <Stat label="En cours" value={stats.enCours} tone="text-amber-600 dark:text-amber-300" />
            <Stat label="Maîtrisées" value={stats.maitrisees} tone="text-emerald-600 dark:text-emerald-300" />
          </dl>
          <div className="mt-5" aria-label="Répartition dans les boîtes">
            <div className="flex h-20 items-end gap-1.5">
              {counts.map((n, b) => (
                <div key={b} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs text-slate-500 tabular-nums">{n}</span>
                  <div
                    className="w-full rounded-t-md bg-linear-to-t from-violet-500 to-fuchsia-400 transition-all"
                    style={{ height: `${stats.total ? Math.max(4, (n / stats.total) * 56) : 4}px`, opacity: n ? 1 : 0.25 }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1.5 text-center text-[10px] text-slate-400">
              {BOXES.map((b) => (
                <span key={b} className="flex-1 truncate">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5">
          {stats.dues > 0 ? (
            <button
              type="button"
              onClick={() => start(false)}
              className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-500 to-fuchsia-500 px-5 text-lg font-semibold text-white shadow-xl shadow-violet-500/30 transition hover:brightness-110 active:scale-[0.99]"
            >
              Réviser maintenant · {plural(stats.dues, "carte")}
            </button>
          ) : (
            <div className="rounded-2xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/10">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Bravo, rien à revoir aujourd'hui ! 🎉</p>
              {Number.isFinite(soonest) && (
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Prochaine révision : {nextReview.format(soonest)}.</p>
              )}
            </div>
          )}
          {doc.cartes.length > 0 && (
            <button type="button" onClick={() => start(true)} className={`${btn.secondary} mt-3 w-full`}>
              <ShuffleIcon size={15} /> Réviser tout le paquet quand même
            </button>
          )}
          {doc.cartes.length > 0 && (
            <button
              type="button"
              className={`${btn.secondary} mt-2 w-full`}
              onClick={() => {
                const oral = oralFromFlashcards(doc);
                if (!oral.questions.length) return toast.error("Écris d'abord le recto et le verso de tes cartes.");
                try {
                  saveDoc(oral);
                  touchClasseur(oral.classeurId);
                  openDoc(oral.id);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Création impossible.");
                }
              }}
            >
              <MessageQuestionIcon size={16} /> M'interroger à l'oral sur ce paquet
            </button>
          )}
        </section>
      </Page>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2.5 dark:bg-slate-800/50">
      <dd className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</dd>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`${value} % maîtrisé`}>
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="8" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          stroke="url(#flash-grad)"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
        <defs>
          <linearGradient id="flash-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#d946ef" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">{value}%</span>
    </div>
  );
}

// ---------- Édition des cartes ----------

function DeckEditor({
  doc,
  update,
  onDone,
}: {
  doc: FlashcardsDoc;
  update: (fn: (d: FlashcardsDoc) => FlashcardsDoc, opts?: { key?: string }) => void;
  onDone: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const setCard = (id: string, patch: { recto?: string; verso?: string }, key: string) =>
    update((d) => ({ ...d, cartes: d.cartes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), { key });

  const addCard = () => {
    const c = newCard("", "");
    update((d) => ({ ...d, cartes: [...d.cartes, c] }));
    requestAnimationFrame(() => document.getElementById(`recto-${c.id}`)?.focus());
  };

  return (
    <Page width="max-w-3xl">
      <label className="block text-sm font-semibold">
        Nom du paquet
        <input
          value={doc.titre}
          onChange={(e) => update((d) => ({ ...d, titre: e.target.value.slice(0, 140) }), { key: "titre" })}
          className={`${input} mt-2 h-12 font-normal`}
        />
      </label>
      <ol className="mt-5 space-y-3">
        {doc.cartes.map((c, n) => (
          <li key={c.id} className={`${card} p-3 sm:p-4`}>
            <div className="mb-2 flex items-center">
              <span className="text-sm font-bold text-violet-600 dark:text-violet-300">Carte {n + 1}</span>
              <span className="flex-1" />
              <button
                type="button"
                className={`${btn.icon} hover:text-red-600`}
                onClick={() => update((d) => ({ ...d, cartes: d.cartes.filter((x) => x.id !== c.id) }))}
                aria-label={`Supprimer la carte ${n + 1}`}
              >
                <TrashIcon size={16} />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <AutoTextarea
                id={`recto-${c.id}`}
                value={c.recto}
                onChange={(v) => setCard(c.id, { recto: v.slice(0, 1000) }, `r-${c.id}`)}
                placeholder="Recto : la question"
                aria-label="Recto"
                className={`${input} py-2.5 font-medium`}
              />
              <AutoTextarea
                value={c.verso}
                onChange={(v) => setCard(c.id, { verso: v.slice(0, 3000) }, `v-${c.id}`)}
                placeholder="Verso : la réponse"
                aria-label="Verso"
                className={`${input} py-2.5`}
              />
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" className={`${btn.secondary} border-dashed sm:flex-1`} onClick={addCard}>
          <PlusIcon size={15} /> Ajouter une carte
        </button>
        <button type="button" className={btn.primary} onClick={onDone}>
          <CheckIcon size={16} /> Terminer
        </button>
      </div>
      {doc.cartes.some((c) => c.revues > 0) && (
        <button type="button" className={`${btn.secondary} mt-6 text-red-600 dark:text-red-400`} onClick={() => setConfirmReset(true)}>
          <RefreshIcon size={15} /> Remettre la progression à zéro
        </button>
      )}
      {confirmReset && (
        <Modal
          title="Remettre à zéro ?"
          onClose={() => setConfirmReset(false)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirmReset(false)}>
                Annuler
              </button>
              <button
                className={btn.danger}
                onClick={() => {
                  update((d) => ({ ...d, cartes: d.cartes.map((c) => ({ ...c, boite: 0, prochaine: 0, revues: 0, reussites: 0 })) }));
                  setConfirmReset(false);
                }}
              >
                <XIcon size={15} /> Remettre à zéro
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Toutes les cartes redeviennent « nouvelles ». Les cartes elles-mêmes sont gardées.
          </p>
        </Modal>
      )}
    </Page>
  );
}
