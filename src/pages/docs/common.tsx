import { useEffect } from "react";
import { DownloadIcon, PrinterIcon } from "../../components/Icons";
import { btn } from "../../components/Modal";
import { useToast } from "../../components/Toasts";

/** Ouvre la fenêtre d'impression (le thème sombre est retiré le temps de l'impression). */
export function printPage() {
  window.print();
}

/** Boutons « Imprimer » et « PDF » : le PDF passe par « Enregistrer au format PDF » du navigateur. */
export function PrintButtons({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        className={compact ? btn.icon : `${btn.secondary} max-sm:min-w-11 max-sm:px-3`}
        onClick={printPage}
        title="Imprimer"
        aria-label="Imprimer"
      >
        <PrinterIcon size={17} />
        {/* Sur téléphone, les icônes seules laissent la place aux autres boutons. */}
        {!compact && <span className="max-sm:sr-only">Imprimer</span>}
      </button>
      <button
        type="button"
        className={compact ? btn.icon : `${btn.secondary} max-sm:min-w-11 max-sm:px-3`}
        title="Exporter en PDF"
        aria-label="Exporter en PDF"
        onClick={() => {
          toast.info("Dans la fenêtre qui s'ouvre, choisis « Enregistrer au format PDF » comme imprimante.");
          setTimeout(printPage, 600);
        }}
      >
        <DownloadIcon size={17} />
        {!compact && <span className="max-sm:sr-only">PDF</span>}
      </button>
    </>
  );
}

/** Ctrl + Z / Ctrl + Y (ou Cmd sur Mac) pour annuler / rétablir dans un document. */
export function useUndoShortcuts(undo: () => void, redo: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, enabled]);
}

const dayFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
export const printDate = (ts: number) => dayFormat.format(ts);
