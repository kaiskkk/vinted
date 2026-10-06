import { useEffect, useState } from "react";

/**
 * - « desktop » : ordinateur et tablette ;
 * - « phone » : téléphone en portrait (ou fenêtre étroite) ;
 * - « phone-landscape » : téléphone tenu à l'horizontale (peu de hauteur).
 */
export type Layout = "desktop" | "phone" | "phone-landscape";

const NARROW = "(max-width: 767.98px)";
const SHORT_TOUCH = "(max-height: 500px) and (pointer: coarse) and (orientation: landscape)";

function current(): Layout {
  if (window.matchMedia(SHORT_TOUCH).matches) return "phone-landscape";
  if (window.matchMedia(NARROW).matches) return "phone";
  return "desktop";
}

const typing = () => {
  const el = document.activeElement;
  return el instanceof HTMLElement && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
};

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(current);
  useEffect(() => {
    const queries = [NARROW, SHORT_TOUCH].map((q) => window.matchMedia(q));
    // Le clavier du téléphone réduit la hauteur de l'écran : on ne change pas de mise en page
    // pendant la saisie, seulement une fois le champ quitté.
    const onChange = () => {
      if (!typing()) setLayout(current());
    };
    const onFocusOut = () => setTimeout(onChange, 50);
    queries.forEach((q) => q.addEventListener("change", onChange));
    document.addEventListener("focusout", onFocusOut);
    return () => {
      queries.forEach((q) => q.removeEventListener("change", onChange));
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return layout;
}

export const isPhone = (l: Layout) => l !== "desktop";
