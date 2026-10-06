import { lazy, Suspense } from "react";
import { AccessCodePrompt } from "./components/AccessCodePrompt";
import { Spinner } from "./components/Icons";
import { ToastProvider } from "./components/Toasts";
import { useHashRoute } from "./hooks/useHashRoute";
import Home from "./pages/Home";

const RELOAD_FLAG = "mm-rechargement-editeur";

// L'éditeur (React Flow, disposition…) n'est chargé qu'à l'ouverture d'une carte :
// la page d'accueil s'affiche plus vite, surtout sur téléphone.
const EditorPage = lazy(() =>
  import("./pages/Editor")
    .then((m) => {
      sessionStorage.removeItem(RELOAD_FLAG);
      return m;
    })
    .catch((err) => {
      // Après une mise à jour du site, l'ancien fichier peut avoir disparu : on recharge une fois.
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }),
);

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
      <Spinner /> Ouverture de la carte…
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  return (
    <ToastProvider>
      {route.page === "editor" ? (
        <Suspense fallback={<Loading />}>
          <EditorPage key={route.mapId} mapId={route.mapId} />
        </Suspense>
      ) : (
        <Home />
      )}
      <AccessCodePrompt />
    </ToastProvider>
  );
}
