import { useState } from "react";
import type { ItemKind } from "../lib/library";
import { createShareLink, shareSupported } from "../lib/share";
import { CheckIcon, LinkIcon, ShareIcon, Spinner } from "./Icons";
import { Modal, btn } from "./Modal";
import { useToast } from "./Toasts";

/**
 * Bouton « Partager » : crée un lien vers une copie du document, à envoyer à un ami
 * (qui pourra l'ajouter à ses documents). Invisible sans comptes.
 */
export function ShareButton({
  kind,
  id,
  titre,
  compact = false,
  className = "",
}: {
  kind: ItemKind;
  id: string;
  titre: string;
  compact?: boolean;
  className?: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!shareSupported) return null;

  const create = async () => {
    if (!navigator.onLine) return toast.error("Le partage a besoin d'internet : reconnecte-toi puis réessaie.");
    setBusy(true);
    try {
      setLink(await createShareLink(kind, id));
      setCopied(false);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      toast.error(
        code === "permission-denied"
          ? "Le partage n'est pas encore autorisé dans Firebase : mets à jour les règles Firestore (voir le README)."
          : err instanceof Error
            ? err.message
            : "Partage impossible. Réessaie.",
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast.info("Sélectionne le lien et copie-le à la main.");
    }
  };

  const shareNative = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: titre, text: `Je te partage « ${titre} » sur ecoleduc`, url: link });
    } catch {
      // Partage annulé : rien à faire.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy}
        className={`${compact ? btn.icon : `${btn.secondary} max-sm:min-w-11 max-sm:px-3`} ${className}`}
        title="Partager avec un lien"
        aria-label={`Partager « ${titre} »`}
      >
        {busy ? <Spinner className="h-4 w-4" /> : <ShareIcon size={compact ? 16 : 17} />}
        {!compact && <span className="max-sm:sr-only">Partager</span>}
      </button>
      {link && (
        <Modal
          title="Lien de partage"
          onClose={() => setLink(null)}
          footer={
            <>
              <button type="button" className={btn.secondary} onClick={() => setLink(null)}>
                Fermer
              </button>
              {typeof navigator.share === "function" && (
                <button type="button" className={btn.secondary} onClick={() => void shareNative()}>
                  <ShareIcon size={16} /> Envoyer…
                </button>
              )}
              <button type="button" className={btn.primary} onClick={() => void copy()}>
                {copied ? <CheckIcon size={16} /> : <LinkIcon size={16} />} {copied ? "Lien copié !" : "Copier le lien"}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Envoie ce lien à un ami : il pourra ajouter une copie de « {titre} » à ses documents (il doit avoir un compte). Tes réponses, tes scores
            et ton brouillon ne sont pas partagés.
          </p>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            aria-label="Lien de partage"
            className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </Modal>
      )}
    </>
  );
}
