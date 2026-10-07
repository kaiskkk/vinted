import { useEffect, useRef, useState, type ReactNode } from "react";
import { DIFFICULTES, type Difficulte, type TypeEtude } from "../../shared/study";
import { DocList } from "../components/DocList";
import {
  AlertIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ChatIcon,
  ChevronDownIcon,
  PencilIcon,
  RefreshIcon,
  SendIcon,
  Spinner,
  TrashIcon,
} from "../components/Icons";
import { KIND_LOOK, KindBadge } from "../components/looks";
import { Modal, btn } from "../components/Modal";
import { BottomSheet } from "../components/Sheet";
import { SimplifyButton } from "../components/Simplify";
import { useToast } from "../components/Toasts";
import {
  AutoTextarea,
  ClaudeTaskOverlay,
  NiveauPicker,
  Page,
  PageHeader,
  RichText,
  Segmented,
  card,
  useClaudeTask,
  useNiveau,
} from "../components/ui";
import { openDoc, openMap, openMode } from "../hooks/useHashRoute";
import { ApiError, askCourse } from "../lib/api";
import { docsOfClasseur, loadClasseur, mapIdsOfClasseur, saveClasseur, type ChatMessage, type Classeur } from "../lib/docs";
import { plural } from "../lib/format";
import { generateCarte, generateDoc, prepareSource } from "../lib/generate";
import { deleteClasseurDeep, restore, type LibraryItem } from "../lib/library";
import { newId } from "../lib/mapModel";
import { loadMap } from "../lib/storage";
import { ClasseurForm } from "./General";
import { PlanningForm } from "./ModePage";

type Action = "carte" | TypeEtude;

const ACTIONS: { action: Action; titre: string; detail: string; loading: string }[] = [
  { action: "carte", titre: "Carte mentale", detail: "Toutes les idées en branches", loading: "Claude dessine ta carte mentale…" },
  { action: "fiche", titre: "Fiche de cours", detail: "Notions, définitions, exemples", loading: "Claude prépare ta fiche…" },
  { action: "revision", titre: "Fiche de révision", detail: "L'essentiel et le top 10", loading: "Claude condense ton cours…" },
  { action: "quiz", titre: "Quiz", detail: "QCM corrigés et expliqués", loading: "Claude prépare ton quiz…" },
  { action: "flashcards", titre: "Flashcards", detail: "Recto / verso à mémoriser", loading: "Claude prépare tes flashcards…" },
  { action: "resume", titre: "Résumé", detail: "Le cours en quelques paragraphes", loading: "Claude résume ton cours…" },
];
const KIND_OF: Record<Action, keyof typeof KIND_LOOK> = {
  carte: "carte",
  fiche: "fiche",
  revision: "revision",
  quiz: "quiz",
  flashcards: "flashcards",
  resume: "resume",
};

const SUGGESTIONS = [
  "Explique-moi l'idée principale",
  "Donne-moi un exemple concret",
  "Pose-moi une question pour vérifier",
  "Qu'est-ce qui tombe souvent à l'examen ?",
];
const MAX_MESSAGES = 60;

function contents(id: string): LibraryItem[] {
  const docs: LibraryItem[] = docsOfClasseur(id).map((d) => ({
    kind: d.type,
    id: d.id,
    titre: d.titre,
    updatedAt: d.updatedAt,
    info: d.info,
    classeurId: id,
  }));
  const maps: LibraryItem[] = mapIdsOfClasseur(id).flatMap((m) => {
    const map = loadMap(m);
    return map
      ? [{ kind: "carte" as const, id: map.id, titre: map.name, updatedAt: map.updatedAt, info: plural(map.nodes.length, "idée"), classeurId: id }]
      : [];
  });
  return [...docs, ...maps].sort((a, b) => b.updatedAt - a.updatedAt);
}

export default function ClasseurPage({ id }: { id: string }) {
  const [classeur, setClasseur] = useState<Classeur | null>(() => loadClasseur(id));
  if (!classeur) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">Ce classeur est introuvable.</p>
        <p className="text-sm text-slate-500">Il a peut-être été supprimé, ou créé dans un autre navigateur.</p>
        <button className={btn.primary} onClick={() => openMode("general")}>
          <ArrowLeftIcon size={16} /> Mes classeurs
        </button>
      </div>
    );
  }
  return <ClasseurView classeur={classeur} setClasseur={setClasseur} />;
}

function ClasseurView({ classeur, setClasseur }: { classeur: Classeur; setClasseur: (c: Classeur) => void }) {
  const toast = useToast();
  const task = useClaudeTask();
  const [niveau] = useNiveau();
  const [items, setItems] = useState(() => contents(classeur.id));
  const [view, setView] = useState<"main" | "edit" | "planning">("main");
  const [options, setOptions] = useState<Action | null>(null);
  const [showCourse, setShowCourse] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = () => setItems(contents(classeur.id));

  const save = (next: Classeur) => {
    try {
      saveClasseur(next);
      setClasseur(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sauvegarde impossible.");
    }
  };

  const generate = (action: Action, opts: { nombre?: number; difficulte?: Difficulte } = {}) => {
    const meta = ACTIONS.find((a) => a.action === action)!;
    const source = { cours: classeur.cours, sujet: classeur.sujet || classeur.nom };
    void task.run(meta.loading, async (signal) => {
      if (action === "carte") {
        const mapId = await generateCarte(classeur.nom, source, niveau, classeur.id, signal);
        openMap(mapId);
      } else {
        const doc = await generateDoc(action, source, niveau, opts, classeur.id, signal);
        openDoc(doc.id);
      }
    });
  };

  if (view === "edit") {
    return (
      <ClasseurForm
        title="Modifier le classeur"
        initialNom={classeur.nom}
        initialSource={{ cours: classeur.cours, sujet: classeur.sujet, fichiers: classeur.fichiers }}
        submitLabel="Enregistrer"
        onCancel={() => setView("main")}
        onSubmit={(nom, source) => {
          save({ ...classeur, nom, cours: source.cours, sujet: source.sujet, fichiers: source.fichiers, updatedAt: Date.now() });
          setView("main");
          toast.success("Classeur enregistré.");
        }}
      />
    );
  }
  if (view === "planning") {
    return <PlanningForm onCancel={() => setView("main")} classeurId={classeur.id} />;
  }

  const preview = classeur.cours.trim();
  const sourceLabel = preview
    ? `${classeur.fichiers.length ? `${classeur.fichiers.join(", ")} · ` : ""}${preview.length.toLocaleString("fr-FR")} caractères`
    : `Sujet : ${classeur.sujet}`;

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={classeur.nom}
        subtitle="Classeur"
        onBack={() => openMode("general")}
        actions={
          <>
            <button type="button" className={btn.icon} onClick={() => setView("edit")} title="Modifier le cours" aria-label="Modifier le cours">
              <PencilIcon size={17} />
            </button>
            <button
              type="button"
              className={`${btn.icon} hover:text-red-600 dark:hover:text-red-400`}
              onClick={() => setConfirmDelete(true)}
              title="Supprimer le classeur"
              aria-label="Supprimer le classeur"
            >
              <TrashIcon size={17} />
            </button>
          </>
        }
      />
      <Page>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-8">
            <section className={`${card} p-4`} aria-labelledby="cours">
              <div className="flex items-center gap-3">
                <KindBadge kind="classeur" size="sm" />
                <div className="min-w-0 flex-1">
                  <h2 id="cours" className="font-semibold">
                    Ton cours
                  </h2>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sourceLabel}</p>
                </div>
                {preview && (
                  <button type="button" className={btn.secondary} onClick={() => setShowCourse((s) => !s)} aria-expanded={showCourse}>
                    {showCourse ? "Masquer" : "Lire"}
                    <ChevronDownIcon size={15} className={`transition ${showCourse ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
              {preview && showCourse && (
                <div className="mm-scroll mt-3 max-h-80 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                  {preview}
                </div>
              )}
            </section>

            <section aria-labelledby="preparer">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 id="preparer" className="mr-auto text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Que veux-tu préparer ?
                </h2>
                <NiveauPicker />
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ACTIONS.map((a) => {
                  const look = KIND_LOOK[KIND_OF[a.action]];
                  return (
                    <li key={a.action}>
                      <button
                        type="button"
                        disabled={task.busy}
                        onClick={() => (a.action === "quiz" || a.action === "flashcards" ? setOptions(a.action) : generate(a.action))}
                        className={`${card} group flex h-full min-h-28 w-full flex-col items-start p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] disabled:opacity-60`}
                      >
                        <KindBadge kind={KIND_OF[a.action]} />
                        <span className="mt-2 font-semibold">{a.titre}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{a.detail}</span>
                        <span className={`mt-auto pt-2 text-xs font-semibold ${look.text}`}>Générer →</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={() => setView("planning")} className={`${btn.secondary} mt-3 w-full sm:w-auto`}>
                <CalendarIcon size={16} /> Prévoir un planning de révision
              </button>
            </section>

            <section aria-labelledby="contenu">
              <h2 id="contenu" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Dans ce classeur {items.length > 0 && <span className="ml-1 text-slate-400 dark:text-slate-500">({items.length})</span>}
              </h2>
              {items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Rien pour l'instant : choisis ci-dessus ce que Claude doit préparer.
                </p>
              ) : (
                <DocList items={items} onChange={refresh} />
              )}
            </section>
          </div>

          <ChatPanel classeur={classeur} save={save} />
        </div>
      </Page>

      <GenerateOptions
        action={options}
        onClose={() => setOptions(null)}
        onGenerate={(action, opts) => {
          setOptions(null);
          generate(action, opts);
        }}
      />
      <ClaudeTaskOverlay task={task} />

      {confirmDelete && (
        <Modal
          title="Supprimer ce classeur ?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirmDelete(false)}>
                Annuler
              </button>
              <button
                className={btn.danger}
                onClick={() => {
                  const snap = deleteClasseurDeep(classeur.id);
                  toast.success(`Classeur supprimé : « ${classeur.nom} ».`, { label: "Annuler", onClick: () => restore(snap) });
                  openMode("general");
                }}
              >
                <TrashIcon size={16} /> Supprimer
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            « {classeur.nom} », son cours, sa discussion et {plural(items.length, "document")} seront supprimés de cet appareil.
          </p>
        </Modal>
      )}
    </div>
  );
}

// ---------- Options (quiz, flashcards) ----------

function GenerateOptions({
  action,
  onClose,
  onGenerate,
}: {
  action: Action | null;
  onClose: () => void;
  onGenerate: (action: Action, opts: { nombre?: number; difficulte?: Difficulte }) => void;
}) {
  const [nombre, setNombre] = useState(10);
  const [difficulte, setDifficulte] = useState<Difficulte>("moyen");
  useEffect(() => {
    if (action) setNombre(action === "quiz" ? 10 : 20);
  }, [action]);
  if (!action) return null;
  const quiz = action === "quiz";
  return (
    <BottomSheet open onClose={onClose} backdrop title={quiz ? "Ton quiz" : "Tes flashcards"} label="Options de génération" maxHeight="80dvh">
      <div className="space-y-5 px-5 pt-2 pb-4">
        <div>
          <p className="mb-2 text-sm font-semibold">{quiz ? "Nombre de questions" : "Nombre de cartes"}</p>
          <Segmented
            label="Nombre"
            value={nombre}
            onChange={setNombre}
            options={(quiz ? [5, 10, 15, 20] : [10, 20, 30]).map((n) => ({ value: n, label: String(n) }))}
          />
        </div>
        {quiz && (
          <div>
            <p className="mb-2 text-sm font-semibold">Difficulté</p>
            <Segmented label="Difficulté" value={difficulte} onChange={setDifficulte} options={DIFFICULTES} />
          </div>
        )}
        <button
          type="button"
          onClick={() => onGenerate(action, quiz ? { nombre, difficulte } : { nombre })}
          className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] ${KIND_LOOK[action].gradient}`}
        >
          Générer avec Claude
        </button>
      </div>
    </BottomSheet>
  );
}

// ---------- Discussion sur le cours ----------

function ChatPanel({ classeur, save }: { classeur: Classeur; save: (c: Classeur) => void }) {
  const [niveau] = useNiveau();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(classeur);
  latest.current = classeur;
  const messages = classeur.chat;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);
  useEffect(() => () => controller.current?.abort(), []);

  const ask = async (text: string, base: ChatMessage[] = messages) => {
    const q = text.trim();
    if (!q || pending) return;
    const userMsg: ChatMessage = { id: newId(), role: "user", texte: q.slice(0, 2000), date: Date.now() };
    const withQuestion = [...base, userMsg].slice(-MAX_MESSAGES);
    save({ ...latest.current, chat: withQuestion, updatedAt: Date.now() });
    setQuestion("");
    setPending(true);
    const c = new AbortController();
    controller.current = c;
    let reply: ChatMessage;
    try {
      if (!navigator.onLine) throw new ApiError("Tu es hors connexion. Reconnecte-toi puis réessaie.", 0, true);
      const prior = base.filter((m) => !m.erreur).map((m) => ({ role: m.role, texte: m.texte.slice(0, 6000) }));
      const { reponse } = await askCourse(
        prepareSource({ cours: latest.current.cours, sujet: latest.current.sujet || latest.current.nom }),
        niveau,
        prior,
        q,
        c.signal,
      );
      reply = { id: newId(), role: "assistant", texte: reponse, date: Date.now() };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      reply = { id: newId(), role: "assistant", texte: err instanceof Error ? err.message : "Réponse impossible.", date: Date.now(), erreur: true };
    } finally {
      setPending(false);
      controller.current = null;
    }
    save({ ...latest.current, chat: [...latest.current.chat, reply].slice(-MAX_MESSAGES), updatedAt: Date.now() });
  };

  /** Réessayer : on retire la réponse en erreur et la question, puis on la repose. */
  const retry = (errorId: string) => {
    const idx = messages.findIndex((m) => m.id === errorId);
    const questionMsg = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!questionMsg) return;
    const base = messages.filter((m) => m.id !== errorId && m.id !== questionMsg.id);
    void ask(questionMsg.texte, base);
  };

  return (
    <section className={`${card} flex max-h-[min(720px,85dvh)] min-h-[420px] flex-col overflow-hidden lg:sticky lg:top-20`} aria-labelledby="chat">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <ChatIcon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="chat" className="font-semibold">
            Questions sur le cours
          </h2>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">Claude répond à partir de ton cours</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className={btn.icon}
            onClick={() => setConfirmClear(true)}
            title="Effacer la discussion"
            aria-label="Effacer la discussion"
          >
            <TrashIcon size={16} />
          </button>
        )}
      </div>

      <div ref={listRef} className="mm-scroll flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && !pending && (
          <div className="py-4 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">Pose une question, par exemple :</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="min-h-9 rounded-full border border-indigo-200 bg-indigo-50/60 px-3 text-sm text-indigo-700 transition hover:bg-indigo-100 tap:min-h-11 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} titre={classeur.nom} onRetry={() => retry(m.id)} />
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Spinner /> Claude réfléchit…
          </div>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <AutoTextarea
          value={question}
          onChange={setQuestion}
          minRows={1}
          placeholder="Ta question…"
          aria-label="Ta question sur le cours"
          enterKeyHint="send"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(question);
            }
          }}
          className="mm-scroll max-h-36 min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base outline-none focus:border-indigo-400 sm:text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={!question.trim() || pending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-40"
          aria-label="Envoyer"
        >
          <SendIcon size={17} />
        </button>
      </form>

      {confirmClear && (
        <Modal
          title="Effacer la discussion ?"
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setConfirmClear(false)}>
                Annuler
              </button>
              <button
                className={btn.danger}
                onClick={() => {
                  save({ ...latest.current, chat: [], updatedAt: Date.now() });
                  setConfirmClear(false);
                }}
              >
                Effacer
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">Les questions et réponses de ce classeur seront effacées.</p>
        </Modal>
      )}
    </section>
  );
}

function Bubble({ message, titre, onRetry }: { message: ChatMessage; titre: string; onRetry: () => void }): ReactNode {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2 text-sm whitespace-pre-wrap text-white">{message.texte}</p>
      </div>
    );
  }
  if (message.erreur) {
    return (
      <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
        <p className="flex items-start gap-2">
          <AlertIcon size={16} className="mt-0.5 shrink-0" /> {message.texte}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white tap:min-h-11"
        >
          <RefreshIcon size={13} /> Réessayer
        </button>
      </div>
    );
  }
  return (
    <div className="max-w-[92%]">
      <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed dark:bg-slate-800">
        <RichText text={message.texte} />
      </div>
      <SimplifyButton text={message.texte} contexte={titre} className="mt-0.5" />
    </div>
  );
}
