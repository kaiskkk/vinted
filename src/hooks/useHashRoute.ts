import { useEffect, useState } from "react";

export type Route = { page: "home" } | { page: "editor"; mapId: string };

function parse(hash: string): Route {
  const m = /^#\/carte\/([^/?#]+)/.exec(hash);
  return m ? { page: "editor", mapId: decodeURIComponent(m[1]) } : { page: "home" };
}

/** Routage minimal par hash : #/ (accueil) et #/carte/<id> (éditeur). */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const goHome = () => {
  window.location.hash = "#/";
};
export const openMap = (id: string) => {
  window.location.hash = `#/carte/${encodeURIComponent(id)}`;
};
