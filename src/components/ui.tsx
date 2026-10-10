// Briques d'interface partagées par les modes d'étude : en-tête de page, sélecteurs,
// texte enrichi, génération avec Claude (chargement, erreur, réessayer), niveau scolaire.
import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { NIVEAUX, type Niveau } from "../../shared/study";
import { useTheme } from "../hooks/useTheme";
import { ApiError } from "../lib/api";
import { getNiveau, setNiveau } from "../lib/docs";
import { AlertIcon, ArrowLeftIcon, ChevronDownIcon, GraduationIcon, RefreshIcon, Spinner, WifiOffIcon, XIcon } from "./Icons";
import { btn } from "./Modal";
import { ThemeToggle } from "./ThemeToggle";

export const card = "rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/75";
export const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

// ---------- Page ----------

export function PageHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Retour",
  actions,
  width = "max-w-5xl",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  width?: string;
}) {
  const { theme, toggle } = useTheme();
  return (
    <header
      className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#0b0e17]/85"
      style={{ paddingTop: "var(--safe-top)", paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}
    >
      <div className={`mx-auto flex min-h-14 items-center gap-1 px-2 sm:gap-2 sm:px-4 ${width}`}>
        {onBack && (
          <button type="button" className={btn.icon} onClick={onBack} title={backLabel} aria-label={backLabel}>
            <ArrowLeftIcon />
          </button>
        )}
        <div className="min-w-0 flex-1 py-1.5">
          <h1 className="truncate text-base leading-tight font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {actions}
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </div>
    </header>
  );
}

export function Page({ children, width = "max-w-5xl", className = "" }: { children: ReactNode; width?: string; className?: string }) {
  return (
    <main
      className={`mx-auto w-full px-4 pt-5 pb-16 sm:px-6 sm:pt-8 ${width} ${className}`}
      style={{
        paddingLeft: "max(1rem, var(--safe-left))",
        paddingRight: "max(1rem, var(--safe-right))",
        paddingBottom: "calc(4rem + var(--safe-bottom))",
      }}
    >
      {children}
    </main>
  );
}

// ---------- Sélecteurs ----------

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className = "",
  oneLine = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
  /** Toujours sur une ligne, colonnes égales (texte plus petit sur téléphone). */
  oneLine?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${oneLine ? "grid auto-cols-fr grid-flow-col" : "flex flex-wrap"} gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-lg font-medium whitespace-nowrap transition tap:min-h-11 ${
              oneLine ? "min-w-0 truncate px-1 text-[13px] sm:px-3 sm:text-sm" : "flex-1 px-3 text-sm"
            } ${
              active
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Niveau scolaire (partagé par toutes les pages) ----------

const niveauListeners = new Set<() => void>();
const subscribeNiveau = (cb: () => void) => {
  niveauListeners.add(cb);
  return () => niveauListeners.delete(cb);
};

export function useNiveau(): [Niveau, (n: Niveau) => void] {
  const niveau = useSyncExternalStore(subscribeNiveau, getNiveau, () => "lycee" as Niveau);
  const change = useCallback((n: Niveau) => {
    setNiveau(n);
    niveauListeners.forEach((l) => l());
  }, []);
  return [niveau, change];
}

/** Petit menu « Niveau : Lycée » : Claude adapte son vocabulaire. */
export function NiveauPicker({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [niveau, setNiveauState] = useNiveau();
  return (
    <label
      className={`relative inline-flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 pr-8 pl-3 text-sm text-slate-700 transition focus-within:border-indigo-400 tap:min-h-11 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 ${
        compact ? "max-[399px]:pr-7 max-[399px]:pl-2.5" : ""
      } ${className}`}
      title="L'IA adapte son vocabulaire à ton niveau"
    >
      {/* Petit écran (en-tête de l'accueil) : sans l'icône, pour laisser la place aux autres boutons. */}
      <GraduationIcon size={17} className={`shrink-0 text-indigo-500 ${compact ? "max-[399px]:hidden" : ""}`} />
      <span className="sr-only">Mon niveau</span>
      <select
        value={niveau}
        onChange={(e) => setNiveauState(e.target.value as Niveau)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        aria-label="Mon niveau scolaire"
      >
        {NIVEAUX.map((n) => (
          <option key={n.value} value={n.value}>
            {n.label}
          </option>
        ))}
      </select>
      <span className="truncate font-medium">{NIVEAUX.find((n) => n.value === niveau)?.court}</span>
      <ChevronDownIcon size={15} className="pointer-events-none absolute right-2.5 text-slate-400" />
    </label>
  );
}

// ---------- Texte enrichi (gras, surligné, listes) ----------

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+?\*\*|==[^=\n]+?==)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 4 && part.startsWith("==") && part.endsWith("==")) {
      return (
        <mark key={i} className="rounded-sm bg-yellow-200/90 px-0.5 text-inherit dark:bg-yellow-300/25">
          {part.slice(2, -2)}
        </mark>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/**
 * Affiche le texte produit par Claude ou saisi par l'élève : **gras**, ==surligné==,
 * listes « - » et « 1. ». Aucun HTML n'est interprété.
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let items: string[] = [];
  let ordered = false;

  const flushPara = () => {
    if (!para.length) return;
    const lines = para;
    blocks.push(
      <p key={blocks.length}>
        {lines.map((l, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {inline(l)}
          </Fragment>
        ))}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!items.length) return;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`${ordered ? "list-decimal" : "list-disc"} space-y-0.5 pl-5 marker:text-current/50`}>
        {items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    );
    items = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-•*]\s+(.*)$/.exec(line);
    const number = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || number) {
      flushPara();
      if (items.length && ordered !== Boolean(number)) flushList();
      ordered = Boolean(number);
      items.push((bullet ?? number)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className={`space-y-1.5 break-words ${className}`}>{blocks}</div>;
}

// ---------- Génération avec Claude ----------

export type TaskState = { status: "idle" } | { status: "loading"; label: string } | { status: "error"; message: string; offline?: boolean };

/**
 * Lance un appel à Claude avec chargement, annulation et « Réessayer ».
 * La tâche reçoit un signal d'annulation.
 */
export function useClaudeTask() {
  const [state, setState] = useState<TaskState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);
  const last = useRef<{ label: string; task: (signal: AbortSignal) => Promise<void> } | null>(null);

  const run = useCallback(async (label: string, task: (signal: AbortSignal) => Promise<void>) => {
    last.current = { label, task };
    if (!navigator.onLine) {
      setState({ status: "error", offline: true, message: "Tu es hors connexion. L'IA a besoin d'internet : reconnecte-toi puis réessaie." });
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setState({ status: "loading", label });
    try {
      await task(c.signal);
      if (controller.current === c) setState({ status: "idle" });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setState({ status: "idle" });
        return;
      }
      const message = err instanceof ApiError || err instanceof Error ? err.message : "Une erreur inattendue est survenue. Réessaie.";
      setState({ status: "error", message });
    } finally {
      if (controller.current === c) controller.current = null;
    }
  }, []);

  const retry = useCallback(() => {
    if (last.current) void run(last.current.label, last.current.task);
  }, [run]);
  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: "idle" });
  }, []);
  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  useEffect(() => () => controller.current?.abort(), []);

  return { state, run, retry, cancel, dismiss, busy: state.status === "loading" };
}

const STEPS = ["Lecture de ton cours…", "Repérage de l'essentiel…", "Rédaction en cours…", "Mise en forme…", "Vérifications finales…"];

/** Fenêtre de chargement pendant la génération, puis d'erreur avec « Réessayer ». */
export function ClaudeTaskOverlay({ task }: { task: ReturnType<typeof useClaudeTask> }) {
  const { state } = task;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (state.status !== "loading") return;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4500);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state.status === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (state.status === "loading") task.cancel();
      else task.dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, task]);

  if (state.status === "idle") return null;

  return (
    <div className="no-print fixed inset-0 z-[70] flex animate-fade-in items-end justify-center bg-slate-950/50 p-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur-sm sm:items-center">
      <div
        role={state.status === "error" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={state.status === "loading" ? state.label : "Erreur"}
        aria-busy={state.status === "loading"}
        className="w-full max-w-md animate-pop overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {state.status === "loading" ? (
          <div className="p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <Spinner className="h-7 w-7" />
            </div>
            <p className="mt-4 text-lg font-semibold">{state.label}</p>
            <p key={step} className="mt-1 animate-fade-in text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
              {STEPS[step]}
            </p>
            <div className="relative mx-auto mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="absolute inset-y-0 w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-linear-to-r from-indigo-500 to-violet-500" />
            </div>
            <p className="mt-4 text-xs text-slate-400">Cela prend en général 10 à 40 secondes.</p>
            <button type="button" className={`${btn.secondary} mt-5 w-full sm:w-auto`} onClick={task.cancel}>
              Annuler
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
                {state.offline ? <WifiOffIcon size={20} /> : <AlertIcon size={20} />}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">La génération n'a pas abouti</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{state.message}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={btn.secondary} onClick={task.dismiss}>
                <XIcon size={15} /> Fermer
              </button>
              <button type="button" className={btn.primary} onClick={task.retry} autoFocus>
                <RefreshIcon size={15} /> Réessayer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Divers ----------

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="animate-fade-in rounded-3xl border border-dashed border-slate-300 bg-white/50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mx-auto flex w-fit">{icon}</div>
      <p className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Champ de texte qui grandit avec son contenu. */
export function AutoTextarea({
  value,
  onChange,
  className = "",
  minRows = 2,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  minRows?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea ref={ref} rows={minRows} value={value} onChange={(e) => onChange(e.target.value)} className={`resize-none ${className}`} {...rest} />
  );
}
