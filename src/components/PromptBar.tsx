import { useState } from "react";
import { SparklesIcon, Spinner, XIcon } from "./Icons";

export type GenerateMode = "replace" | "append";

interface PromptBarProps {
  loading: boolean;
  onGenerate: (prompt: string, mode: GenerateMode) => Promise<boolean>;
  onCancel: () => void;
  /** « floating » : au-dessus du canevas (ordinateur) ; « compact » : dans l'en-tête (téléphone). */
  variant: "floating" | "compact";
}

const MODES: { value: GenerateMode; label: string; short: string }[] = [
  { value: "replace", label: "Remplacer la carte", short: "Remplacer" },
  { value: "append", label: "Ajouter à la carte", short: "Ajouter" },
];

export function PromptBar({ loading, onGenerate, onCancel, variant }: PromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<GenerateMode>("replace");
  const compact = variant === "compact";

  const submit = async () => {
    const value = prompt.trim();
    if (!value || loading) return;
    (document.activeElement as HTMLElement | null)?.blur(); // referme le clavier du téléphone
    const ok = await onGenerate(value, mode);
    if (ok) setPrompt("");
  };

  const current = MODES.find((m) => m.value === mode)!;

  return (
    <div
      className={`relative w-full overflow-hidden border transition ${
        compact
          ? "rounded-xl bg-slate-100/80 dark:bg-slate-800/70"
          : "pointer-events-auto max-w-3xl rounded-2xl bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:bg-slate-900/85 dark:shadow-black/40"
      } ${
        loading
          ? "border-indigo-400/70"
          : "border-slate-200 focus-within:border-indigo-400 dark:border-slate-700/80 dark:focus-within:border-indigo-400/70"
      }`}
    >
      {loading && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" aria-hidden="true">
          <div className="h-full w-1/3 bg-linear-to-r from-transparent via-indigo-500 to-transparent [animation:shimmer_1.2s_ease-in-out_infinite]" />
        </div>
      )}
      <form
        className={`flex items-center ${compact ? "gap-1 p-1" : "gap-2 p-2"}`}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <SparklesIcon className={`shrink-0 text-indigo-500 ${compact ? "ml-1.5" : "ml-2"}`} size={compact ? 17 : 18} />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          placeholder="Décris ta carte mentale…"
          aria-label="Décris ta carte mentale"
          maxLength={2000}
          enterKeyHint="send"
          className="h-10 min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-slate-400 disabled:opacity-60 md:text-[15px]"
        />

        {compact ? (
          // Téléphone : le mode n'apparaît qu'une fois la demande commencée, et se change d'un toucher.
          prompt.trim() &&
          !loading && (
            <button
              type="button"
              onClick={() => setMode(mode === "replace" ? "append" : "replace")}
              aria-label={`Mode : ${current.label}. Toucher pour changer.`}
              className="h-11 shrink-0 animate-fade-in rounded-lg bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm active:scale-95 dark:bg-slate-700 dark:text-slate-100"
            >
              {current.short}
            </button>
          )
        ) : (
          <div className="flex shrink-0 rounded-xl bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800" role="radiogroup" aria-label="Mode de génération">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                disabled={loading}
                onClick={() => setMode(m.value)}
                className={`rounded-[10px] px-2.5 py-1.5 transition tap:min-h-11 ${
                  mode === m.value
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <button
            // Clés distinctes : React ne doit pas réutiliser le bouton « Générer » (submit),
            // sinon le clic d'annulation pourrait soumettre le formulaire et relancer la génération.
            key="cancel"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onCancel();
            }}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-300 tap:h-11 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            <Spinner />
            <span>{compact ? "Annuler" : "Claude réfléchit…"}</span>
            {!compact && <XIcon size={14} className="opacity-60" />}
          </button>
        ) : (
          <button
            key="submit"
            type="submit"
            disabled={!prompt.trim()}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none tap:h-11 tap:px-3"
          >
            Générer
          </button>
        )}
      </form>
    </div>
  );
}

/** Avertissement (clé absente, hors connexion…) que l'on peut masquer d'un toucher. */
export function PromptWarning({ message, onDismiss, compact }: { message: string; onDismiss: () => void; compact?: boolean }) {
  return (
    <div
      className={`pointer-events-auto flex animate-fade-in items-center gap-1 rounded-xl border border-amber-300/60 bg-amber-50/95 text-amber-800 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-200 ${
        compact ? "py-0.5 pl-3 text-xs" : "mt-2 w-full max-w-3xl py-1 pl-3 text-xs"
      }`}
    >
      <p className="min-w-0 flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Masquer ce message"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg opacity-70 transition hover:opacity-100 tap:h-11 tap:w-11"
      >
        <XIcon size={15} />
      </button>
    </div>
  );
}
