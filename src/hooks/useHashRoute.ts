import { useEffect, useState } from "react";

export type Mode = "general" | "cartes" | "fiches" | "revision" | "quiz" | "flashcards";
export const MODE_IDS: Mode[] = ["general", "cartes", "fiches", "revision", "quiz", "flashcards"];

export type Route =
  | { page: "home" }
  | { page: "mode"; mode: Mode }
  | { page: "editor"; mapId: string }
  | { page: "classeur"; id: string }
  | { page: "doc"; id: string };

function parse(hash: string): Route {
  const m = /^#\/(carte|classeur|doc)\/([^/?#]+)/.exec(hash);
  if (m) {
    const id = decodeURIComponent(m[2]);
    return m[1] === "carte" ? { page: "editor", mapId: id } : m[1] === "classeur" ? { page: "classeur", id } : { page: "doc", id };
  }
  const mode = /^#\/([a-z]+)\/?$/.exec(hash)?.[1] as Mode | undefined;
  if (mode && MODE_IDS.includes(mode)) return { page: "mode", mode };
  return { page: "home" };
}

/**
 * Routage minimal par hash : #/ (accueil), #/<mode>, #/carte/<id> (éditeur de carte mentale),
 * #/classeur/<id> et #/doc/<id> (fiche, quiz, flashcards…).
 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

const go = (hash: string) => {
  window.location.hash = hash;
};

export const goHome = () => go("#/");
export const openMode = (mode: Mode) => go(`#/${mode}`);
export const openMap = (id: string) => go(`#/carte/${encodeURIComponent(id)}`);
export const openClasseur = (id: string) => go(`#/classeur/${encodeURIComponent(id)}`);
export const openDoc = (id: string) => go(`#/doc/${encodeURIComponent(id)}`);

/** Ouvre un élément de la bibliothèque selon son type. */
export function openItem(kind: string, id: string) {
  if (kind === "carte") openMap(id);
  else if (kind === "classeur") openClasseur(id);
  else openDoc(id);
}
