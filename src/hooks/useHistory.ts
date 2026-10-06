import { useCallback, useRef, useState } from "react";
import type { MindEdge, MindNode } from "../types";
import { persistEdge, persistNode } from "../lib/mapModel";

export interface Snapshot {
  nodes: MindNode[];
  edges: MindEdge[];
}

const LIMIT = 100;
/** Deux instantanés de même clé à moins de ce délai sont fusionnés (curseurs, sélecteur de couleur…). */
const MERGE_WINDOW_MS = 1200;

const clean = (s: Snapshot): Snapshot => ({ nodes: s.nodes.map(persistNode), edges: s.edges.map(persistEdge) });

/**
 * Historique annuler / rétablir par instantanés.
 * Appeler `takeSnapshot()` JUSTE AVANT chaque modification de la carte.
 */
export function useHistory(getState: () => Snapshot, setState: (s: Snapshot) => void) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const last = useRef<{ key?: string; time: number } | null>(null);
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const takeSnapshot = useCallback(
    (key?: string) => {
      const now = Date.now();
      if (key && last.current?.key === key && now - last.current.time < MERGE_WINDOW_MS) {
        last.current.time = now;
        return;
      }
      past.current.push(clean(getState()));
      if (past.current.length > LIMIT) past.current.shift();
      future.current = [];
      last.current = { key, time: now };
      bump();
    },
    [getState],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(clean(getState()));
    last.current = null;
    setState(prev);
    bump();
  }, [getState, setState]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(clean(getState()));
    last.current = null;
    setState(next);
    bump();
  }, [getState, setState]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
