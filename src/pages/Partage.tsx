import { useEffect, useState } from "react";
import { PlusIcon, Spinner } from "../components/Icons";
import { KIND_LOOK, KindBadge } from "../components/looks";
import { btn } from "../components/Modal";
import { useToast } from "../components/Toasts";
import { Page, PageHeader, card } from "../components/ui";
import { goHome, openItem } from "../hooks/useHashRoute";
import { fetchShared, importShared, shareSupported, type SharePayload } from "../lib/share";

type State = { kind: "loading" } | { kind: "ok"; payload: SharePayload } | { kind: "error"; message: string };

/** Lien de partage reçu d'un ami : aperçu, puis « Ajouter à mes documents ». */
export default function PartagePage({ id }: { id: string }) {
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!shareSupported) {
      setState({ kind: "error", message: "Les liens de partage demandent les comptes ecoleduc, qui ne sont pas activés sur ce site." });
      return;
    }
    let cancelled = false;
    fetchShared(id)
      .then((payload) => {
        if (cancelled) return;
        setState(payload ? { kind: "ok", payload } : { kind: "error", message: "Ce lien de partage n'existe pas ou n'existe plus." });
      })
      .catch((err) => {
        if (cancelled) return;
        const code = (err as { code?: string })?.code;
        setState({
          kind: "error",
          message:
            code === "permission-denied"
              ? "Le partage n'est pas encore autorisé dans Firebase : il faut mettre à jour les règles Firestore (voir le README)."
              : navigator.onLine
                ? "Impossible d'ouvrir ce lien pour le moment. Réessaie dans un instant."
                : "Tu es hors connexion : reconnecte-toi pour ouvrir ce lien.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const add = () => {
    if (state.kind !== "ok") return;
    setAdding(true);
    try {
      const { kind, id: newId } = importShared(state.payload);
      toast.success(`« ${state.payload.titre} » a été ajouté à tes documents.`);
      openItem(kind, newId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ajout impossible.");
      setAdding(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <PageHeader title="Document partagé" onBack={goHome} backLabel="Retour à l'accueil" width="max-w-xl" />
      <Page width="max-w-xl">
        {state.kind === "loading" && (
          <p className="flex items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400" aria-live="polite">
            <Spinner /> Ouverture du lien…
          </p>
        )}
        {state.kind === "error" && (
          <div className={`${card} p-6 text-center`} role="alert">
            <p className="text-slate-700 dark:text-slate-200">{state.message}</p>
            <button type="button" className={`${btn.secondary} mt-4`} onClick={goHome}>
              Retour à l'accueil
            </button>
          </div>
        )}
        {state.kind === "ok" && (
          <div className={`${card} animate-pop p-6 text-center`}>
            <div className="flex justify-center">
              <KindBadge kind={state.payload.kind} size="lg" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Partage reçu · {KIND_LOOK[state.payload.kind]?.label ?? "Document"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-balance">{state.payload.titre || "Sans titre"}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Ajoute-le à tes documents pour l'ouvrir, le modifier et réviser avec. C'est ta copie : les changements de ton ami n'y apparaîtront pas.
            </p>
            <button
              type="button"
              onClick={add}
              disabled={adding}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-violet-600 px-5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {adding ? <Spinner className="h-4 w-4" /> : <PlusIcon size={18} />} Ajouter à mes documents
            </button>
          </div>
        )}
      </Page>
    </div>
  );
}
