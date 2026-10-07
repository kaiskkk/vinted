import { useCallback, useEffect, useRef, useState } from "react";
import { saveDoc, type StudyDoc } from "../lib/docs";

const LIMIT = 100;
/** Deux modifications de même clé à moins de ce délai forment une seule étape d'annulation (frappe au clavier). */
const MERGE_WINDOW_MS = 1200;
const SAVE_DELAY_MS = 400;

/**
 * État d'un document avec sauvegarde automatique et annuler / rétablir.
 * `update(fn, { key })` : la clé regroupe les modifications rapprochées d'un même champ.
 */
export function useDoc<T extends StudyDoc>(initial: T, onSaveError?: (message: string) => void) {
  const [doc, setDoc] = useState(initial);
  const current = useRef(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const last = useRef<{ key: string; at: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const errorRef = useRef(onSaveError);
  errorRef.current = onSaveError;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    try {
      saveDoc(current.current);
      setSavedAt(Date.now());
    } catch (err) {
      errorRef.current?.(err instanceof Error ? err.message : "Sauvegarde impossible.");
    }
  }, []);

  const commit = useCallback(
    (next: T) => {
      current.current = next;
      setDoc(next);
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  const update = useCallback(
    (fn: (d: T) => T, opts: { key?: string; history?: boolean } = {}) => {
      const prev = current.current;
      const next = { ...fn(prev), updatedAt: Date.now() };
      if (opts.history !== false) {
        const now = Date.now();
        const merge = opts.key && last.current?.key === opts.key && now - last.current.at < MERGE_WINDOW_MS;
        if (!merge) {
          past.current.push(prev);
          if (past.current.length > LIMIT) past.current.shift();
        }
        last.current = opts.key ? { key: opts.key, at: now } : null;
        future.current = [];
      }
      commit(next);
    },
    [commit],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(current.current);
    last.current = null;
    commit({ ...prev, updatedAt: Date.now() });
  }, [commit]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    last.current = null;
    commit({ ...next, updatedAt: Date.now() });
  }, [commit]);

  // Rien ne se perd : sauvegarde en quittant la page ou en fermant l'onglet.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return {
    doc,
    update,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    savedAt,
  };
}
