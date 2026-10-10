import { useEffect, useState } from "react";

export type Mode =
  | "general"
  | "cartes"
  | "fiches"
  | "revision"
  | "quiz"
  | "flashcards"
  | "exercices"
  | "oral"
  | "jeux"
  | "frise"
  | "redaction"
  | "copie"
  | "agenda"
  | "classe";
export const MODE_IDS: Mode[] = [
  "general",
  "cartes",
  "fiches",
  "revision",
  "quiz",
  "flashcards",
  "exercices",
  "oral",
  "jeux",
  "frise",
  "redaction",
  "copie",
  "agenda",
  "classe",
];

export type Route =
  | { page: "home" }
  | { page: "mode"; mode: Mode }
  | { page: "editor"; mapId: string }
  | { page: "classeur"; id: string }
  | { page: "doc"; id: string }
  | { page: "serie" }
  | { page: "partage"; id: string }
  | { page: "groupe"; code: string };

function parse(hash: string): Route {
  const share = /^#\/partage\/([A-Za-z0-9_-]{8,64})/.exec(hash);
  if (share) return { page: "partage", id: share[1] };
  const groupe = /^#\/classe\/([A-Za-z0-9-]{4,20})/.exec(hash);
  if (groupe) return { page: "groupe", code: groupe[1].toUpperCase().replace(/-/g, "") };
  const m = /^#\/(carte|classeur|doc)\/([^/?#]+)/.exec(hash);
  if (m) {
    const id = decodeURIComponent(m[2]);
    return m[1] === "carte" ? { page: "editor", mapId: id } : m[1] === "classeur" ? { page: "classeur", id } : { page: "doc", id };
  }
  const mode = /^#\/([a-z]+)\/?$/.exec(hash)?.[1] as Mode | undefined;
  if ((mode as string) === "serie") return { page: "serie" };
  if (mode && MODE_IDS.includes(mode)) return { page: "mode", mode };
  return { page: "home" };
}

/**
 * Routage minimal par hash : #/ (accueil), #/<mode>, #/carte/<id> (éditeur de carte mentale),
 * #/classeur/<id>, #/doc/<id> (fiche, quiz, flashcards…), #/serie (série de révision), #/partage/<id> (document partagé)
 * et #/classe/<code> (une classe du mode classe).
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
export const openSerie = () => go("#/serie");
export const openClasse = (code: string) => go(`#/classe/${encodeURIComponent(code)}`);

/** Ouvre un élément de la bibliothèque selon son type. */
export function openItem(kind: string, id: string) {
  if (kind === "carte") openMap(id);
  else if (kind === "classeur") openClasseur(id);
  else openDoc(id);
}
