import { createContext, useContext } from "react";

/** Actions de l'éditeur accessibles depuis les nœuds personnalisés. */
export interface EditorContextValue {
  addChild: (parentId: string) => void;
  commitLabel: (id: string, label: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  /** Abscisse du centre du nœud central : sert à placer le bouton « + » côté extérieur. */
  rootCenterX: number;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor doit être utilisé dans l'éditeur");
  return ctx;
}
