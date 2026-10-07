import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, simplify } from "../lib/api";
import { AlertIcon, LightbulbIcon, RefreshIcon, Spinner } from "./Icons";
import { btn } from "./Modal";
import { BottomSheet } from "./Sheet";
import { RichText, useNiveau } from "./ui";

// Explications déjà obtenues pendant la session (même passage, même niveau).
const cache = new Map<string, string>();

/** Bouton « Plus simple » : Claude réexplique le passage avec des mots de tous les jours. */
export function SimplifyButton({
  text,
  contexte,
  className = "",
  compact = false,
}: {
  text: string;
  contexte?: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`no-print inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium text-amber-700 transition hover:bg-amber-50 active:scale-95 tap:min-h-11 tap:min-w-11 dark:text-amber-300 dark:hover:bg-amber-500/10 ${className}`}
        title="Explique-moi plus simplement"
        aria-label="Explique-moi plus simplement"
      >
        <LightbulbIcon size={15} />
        {!compact && <span>Plus simple</span>}
      </button>
      {open && <SimplifySheet text={text} contexte={contexte} onClose={() => setOpen(false)} />}
    </>
  );
}

function SimplifySheet({ text, contexte, onClose }: { text: string; contexte?: string; onClose: () => void }) {
  const [niveau] = useNiveau();
  const key = `${niveau}\n${text}`;
  const [result, setResult] = useState<string | null>(() => cache.get(key) ?? null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!navigator.onLine) {
      setError("Tu es hors connexion. Reconnecte-toi puis réessaie.");
      return;
    }
    setError(null);
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    try {
      const { explication } = await simplify(text.slice(0, 5000), niveau, contexte?.slice(0, 400), c.signal);
      cache.set(key, explication);
      setResult(explication);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Explication impossible. Réessaie.");
    }
  }, [text, niveau, contexte, key]);

  useEffect(() => {
    if (!result) void load();
    return () => controller.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BottomSheet
      open
      onClose={onClose}
      backdrop
      maxHeight="85dvh"
      label="Explique-moi plus simplement"
      title={
        <span className="flex items-center gap-2">
          <LightbulbIcon size={18} className="text-amber-500" /> Plus simplement
        </span>
      }
    >
      <div className="px-5 pb-4">
        <blockquote className="line-clamp-3 border-l-2 border-slate-300 pl-3 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
          {text.replace(/\*\*|==/g, "")}
        </blockquote>
        <div className="mt-4" aria-live="polite">
          {result ? (
            <div className="animate-fade-in rounded-2xl bg-amber-50 p-4 text-[15px] leading-relaxed text-slate-800 dark:bg-amber-500/10 dark:text-slate-100">
              <RichText text={result} />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
              <p className="flex items-start gap-2">
                <AlertIcon size={17} className="mt-0.5 shrink-0" /> {error}
              </p>
              <button type="button" className={`${btn.primary} mt-3 bg-red-600 hover:bg-red-500`} onClick={() => void load()}>
                <RefreshIcon size={15} /> Réessayer
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
              <Spinner /> L'IA cherche une façon plus simple de l'expliquer…
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
