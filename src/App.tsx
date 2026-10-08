import { lazy, Suspense, type ComponentType } from "react";
import { AccessCodePrompt } from "./components/AccessCodePrompt";
import { Spinner } from "./components/Icons";
import { SerieWatcher } from "./components/Serie";
import { ToastProvider } from "./components/Toasts";
import { useHashRoute } from "./hooks/useHashRoute";
import Home from "./pages/Home";
import MindMaps from "./pages/MindMaps";

const RELOAD_FLAG = "mm-rechargement-editeur";

/**
 * Page chargée à la demande : l'accueil s'affiche plus vite, surtout sur téléphone.
 * Après une mise à jour du site, l'ancien fichier peut avoir disparu : on recharge une fois.
 */
function lazyPage<P>(load: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(() =>
    load()
      .then((m) => {
        sessionStorage.removeItem(RELOAD_FLAG);
        return m;
      })
      .catch((err) => {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, "1");
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err;
      }),
  );
}

// L'éditeur (React Flow, disposition…) n'est chargé qu'à l'ouverture d'une carte.
const EditorPage = lazyPage(() => import("./pages/Editor"));
const GeneralPage = lazyPage(() => import("./pages/General"));
const ClasseurPage = lazyPage(() => import("./pages/Classeur"));
const ModePage = lazyPage(() => import("./pages/ModePage"));
const DocPage = lazyPage(() => import("./pages/DocPage"));
const RedactionPage = lazyPage(() => import("./pages/Redaction"));
const SeriePage = lazyPage(() => import("./pages/Serie"));

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
      <Spinner /> {label}
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  let page;
  switch (route.page) {
    case "editor":
      page = (
        <Suspense fallback={<Loading label="Ouverture de la carte…" />}>
          <EditorPage key={route.mapId} mapId={route.mapId} />
        </Suspense>
      );
      break;
    case "classeur":
      page = <ClasseurPage key={route.id} id={route.id} />;
      break;
    case "doc":
      page = <DocPage key={route.id} id={route.id} />;
      break;
    case "serie":
      page = <SeriePage />;
      break;
    case "mode":
      if (route.mode === "cartes") page = <MindMaps />;
      else if (route.mode === "general") page = <GeneralPage />;
      else if (route.mode === "redaction") page = <RedactionPage />;
      else page = <ModePage key={route.mode} mode={route.mode} />;
      break;
    default:
      page = <Home />;
  }
  return (
    <ToastProvider>
      <Suspense fallback={<Loading label="Chargement…" />}>{page}</Suspense>
      <AccessCodePrompt />
      <SerieWatcher />
    </ToastProvider>
  );
}
