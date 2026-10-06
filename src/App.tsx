import { AccessCodePrompt } from "./components/AccessCodePrompt";
import { ToastProvider } from "./components/Toasts";
import { useHashRoute } from "./hooks/useHashRoute";
import EditorPage from "./pages/Editor";
import Home from "./pages/Home";

export default function App() {
  const route = useHashRoute();
  return (
    <ToastProvider>
      {route.page === "editor" ? <EditorPage key={route.mapId} mapId={route.mapId} /> : <Home />}
      <AccessCodePrompt />
    </ToastProvider>
  );
}
