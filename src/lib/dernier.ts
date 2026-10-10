// Dernier élément ouvert sur cet appareil, pour « Reprendre » sur l'accueil.
import type { ItemKind } from "./library";

const KEY = "ed-dernier";

export interface DernierOuvert {
  kind: ItemKind;
  id: string;
  at: number;
}

export function rememberOpened(kind: ItemKind, id: string, now = Date.now()) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ kind, id, at: now }));
  } catch {
    // Non mémorisé : sans gravité.
  }
}

export function lastOpened(): DernierOuvert | null {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<DernierOuvert> | null;
    return o && typeof o.kind === "string" && typeof o.id === "string" && typeof o.at === "number" ? (o as DernierOuvert) : null;
  } catch {
    return null;
  }
}
