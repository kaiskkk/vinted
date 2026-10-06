import { useEffect, useState } from "react";
import { DownloadIcon } from "./Icons";
import { Modal, btn } from "./Modal";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * « Installer l'appli » : bouton natif sur Android / Chrome, mode d'emploi sur iPhone
 * (Safari n'a pas de bouton d'installation). Masqué quand l'appli est déjà installée.
 */
export function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(standalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!deferred && !isIos())) return null;

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            const { outcome } = await deferred.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setDeferred(null);
          } else {
            setShowIosHelp(true);
          }
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-slate-600 transition hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300"
      >
        <DownloadIcon size={16} /> Installer l'appli
      </button>
      {showIosHelp && (
        <Modal
          title="Installer ecoleduc sur ton iPhone"
          onClose={() => setShowIosHelp(false)}
          footer={
            <button className={btn.primary} onClick={() => setShowIosHelp(false)}>
              J'ai compris
            </button>
          }
        >
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              Ouvre ce site dans <strong>Safari</strong>.
            </li>
            <li>
              Touche le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut).
            </li>
            <li>
              Choisis <strong>« Sur l'écran d'accueil »</strong>, puis <strong>Ajouter</strong>.
            </li>
          </ol>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            L'icône ecoleduc apparaît alors sur ton écran d'accueil : elle s'ouvre en plein écran, comme une vraie appli, même sans connexion.
          </p>
        </Modal>
      )}
    </>
  );
}
