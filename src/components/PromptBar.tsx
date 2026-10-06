import { useState } from "react";
import { SparklesIcon, Spinner, XIcon } from "./Icons";

export type GenerateMode = "replace" | "append";

interface PromptBarProps {
  loading: boolean;
  onGenerate: (prompt: string, mode: GenerateMode) => Promise<boolean>;
  onCancel: () => void;
  /** Message d'avertissement (clé API absente, serveur injoignable…). */
  warning?: string | null;
}

export function PromptBar({ loading, onGenerate, onCancel, warning }: PromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<GenerateMode>("replace");

  const submit = async () => {
    const value = prompt.trim();
    if (!value || loading) return;
    const ok = await onGenerate(value, mode);
    if (ok) setPrompt("");
  };

  return (
    <div className="pointer-events-auto w-full max-w-3xl">
      <div
        className={`relative overflow-hidden rounded-2xl border bg-white/90 shadow-xl shadow-slate-900/10 backdrop-blur-md transition dark:bg-slate-900/85 dark:shadow-black/40 ${
          loading ? "border-indigo-400/70" : "border-slate-200 focus-within:border-indigo-400 dark:border-slate-700/80 dark:focus-within:border-indigo-400/70"
        }`}
      >
        {loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" aria-hidden="true">
            <div className="h-full w-1/3 bg-linear-to-r from-transparent via-indigo-500 to-transparent [animation:shimmer_1.2s_ease-in-out_infinite]" />
          </div>
        )}
        <form
          className="flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <SparklesIcon className="ml-2 shrink-0 text-indigo-500" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            placeholder="Décris ta carte mentale…"
            aria-label="Décris ta carte mentale"
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <div className="flex shrink-0 rounded-xl bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800" role="radiogroup" aria-label="Mode de génération">
            {(
              [
                ["replace", "Remplacer la carte"],
                ["append", "Ajouter à la carte"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                disabled={loading}
                onClick={() => setMode(value)}
                className={`rounded-[10px] px-2.5 py-1.5 transition ${
                  mode === value
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              <Spinner />
              <span>Claude réfléchit…</span>
              <XIcon size={14} className="opacity-60" />
            </button>
          ) : (
            <button
              key="submit"
              type="submit"
              disabled={!prompt.trim()}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Générer
            </button>
          )}
        </form>
      </div>
      {warning && (
        <p className="mt-2 animate-fade-in rounded-xl border border-amber-300/60 bg-amber-50/95 px-3 py-2 text-xs text-amber-800 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-200">
          {warning}
        </p>
      )}
    </div>
  );
}
