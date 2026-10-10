import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { AccessCodePrompt } from "./components/AccessCodePrompt";
import { AProposPanel, ArriveeMessage } from "./components/APropos";
import { MinuteurPanel, MinuteurPill, MinuteurWatcher } from "./components/Minuteur";
import { Spinner } from "./components/Icons";
import { AgendaWatcher } from "./components/AgendaWatcher";
import { ReadAloudBar } from "./components/ReadAloud";
import { SerieWatcher } from "./components/Serie";
import { ToastProvider } from "./components/Toasts";
import { useHashRoute } from "./hooks/useHashRoute";
import { rememberOpened } from "./lib/dernier";
import { loadDoc } from "./lib/docs";
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
const CopiePage = lazyPage(() => import("./pages/Copie"));
const AgendaPage = lazyPage(() => import("./pages/Agenda"));
const PartagePage = lazyPage(() => import("./pages/Partage"));
const ClassesPage = lazyPage(() => import("./pages/Classes"));
const ClassePage = lazyPage(() => import("./pages/ClassePage"));

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
      <Spinner /> {label}
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  // Pour « Reprendre » sur l'accueil : la dernière carte, le dernier document ou classeur ouvert.
  const openedKey =
    route.page === "editor" ? `carte:${route.mapId}` : route.page === "classeur" || route.page === "doc" ? `${route.page}:${route.id}` : "";
  useEffect(() => {
    if (!openedKey) return;
    const [page, id] = [openedKey.slice(0, openedKey.indexOf(":")), openedKey.slice(openedKey.indexOf(":") + 1)];
    if (page === "carte") rememberOpened("carte", id);
    else if (page === "classeur") rememberOpened("classeur", id);
    else {
      const doc = loadDoc(id);
      if (doc) rememberOpened(doc.type, id);
    }
  }, [openedKey]);
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
    case "partage":
      page = <PartagePage key={route.id} id={route.id} />;
      break;
    case "groupe":
      page = <ClassePage key={route.code} code={route.code} />;
      break;
    case "mode":
      if (route.mode === "cartes") page = <MindMaps />;
      else if (route.mode === "general") page = <GeneralPage />;
      else if (route.mode === "redaction") page = <RedactionPage />;
      else if (route.mode === "copie") page = <CopiePage />;
      else if (route.mode === "agenda") page = <AgendaPage />;
      else if (route.mode === "classe") page = <ClassesPage />;
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
      <AgendaWatcher />
      <ReadAloudBar />
      <ArriveeMessage route={route} />
      <AProposPanel />
      <MinuteurWatcher />
      <MinuteurPill route={route} />
      <MinuteurPanel />
    </ToastProvider>
  );
}
