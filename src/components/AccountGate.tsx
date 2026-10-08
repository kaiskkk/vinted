import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { firebaseConfig, setSession, setTokenProvider } from "../lib/account";
import { downloadBackup } from "../lib/library";
import { CloudSync, clearLocalData, cloudErrorMessage, localDataSummary, localOwner } from "../lib/sync";
import { ErrorScreen, ImportPrompt, LoadingScreen, LoginPage, type LocalSummary } from "../pages/Login";

type Cloud = typeof import("../lib/cloud");
type Phase =
  | { kind: "loading"; label: string }
  | { kind: "login" }
  | { kind: "import"; email: string; summary: LocalSummary; error: string | null; busy: boolean }
  | { kind: "error"; message: string }
  | { kind: "ready" };

/** Au plus quelques secondes d'attente au démarrage : sans réseau, on continue avec les données de l'appareil. */
const START_PULL_TIMEOUT_MS = 8000;
const LOGOUT_FLUSH_TIMEOUT_MS = 10_000;

const timeout = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Pages où une remise à jour automatique dérangerait (édition en cours). */
const isEditing = () => /^#\/(carte|doc)\//.test(window.location.hash);

/**
 * Comptes obligatoires : rien ne s'affiche tant que l'élève n'est pas connecté.
 * À la première connexion sur un appareil qui contient déjà des données, propose de les importer.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading", label: "Chargement…" });
  const [dataVersion, setDataVersion] = useState(0);
  const cloud = useRef<Cloud | null>(null);
  const sync = useRef<CloudSync | null>(null);
  const [attempt, setAttempt] = useState(0);
  const staleWhileEditing = useRef(false);

  const begin = useCallback(async (s: CloudSync, email: string, pullFirst: boolean) => {
    const c = cloud.current!;
    s.start();
    setSession({
      email,
      sync: s,
      logout: async () => {
        await Promise.race([s.flush(), timeout(LOGOUT_FLUSH_TIMEOUT_MS)]);
        if (
          s.pendingCount() > 0 &&
          !window.confirm(
            "Certaines modifications ne sont pas encore sauvegardées en ligne (pas d'internet ?). Si tu te déconnectes maintenant, elles seront perdues. Se déconnecter quand même ?",
          )
        ) {
          return;
        }
        s.stop();
        clearLocalData();
        await c.logout().catch(() => {});
        window.location.hash = "";
        window.location.reload();
      },
    });
    if (pullFirst) {
      setPhase({ kind: "loading", label: "Récupération de tes données…" });
      await Promise.race([s.pull().catch(() => false), timeout(START_PULL_TIMEOUT_MS)]);
    }
    setPhase({ kind: "ready" });
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    import("../lib/cloud")
      .then((c) => {
        if (cancelled) return;
        cloud.current = c;
        c.initCloud(firebaseConfig!);
        setTokenProvider(c.getToken);
        unsubscribe = c.watchUser((user) => {
          sync.current?.stop();
          sync.current = null;
          if (!user) {
            setSession(null);
            setPhase({ kind: "login" });
            return;
          }
          const s = new CloudSync(c.createBackend(user.uid), user.uid, () => {
            // Données modifiées sur un autre appareil : les listes sont rafraîchies (sauf pendant une édition).
            if (isEditing()) staleWhileEditing.current = true;
            else setDataVersion((v) => v + 1);
          });
          sync.current = s;
          const email = user.email ?? "";
          const owner = localOwner();
          // Données laissées par un autre compte : elles sont déjà dans son compte en ligne.
          if (owner && owner !== user.uid) clearLocalData();
          const summary = localDataSummary();
          if (owner !== user.uid && summary.any) {
            setPhase({ kind: "import", email, summary, error: null, busy: false });
          } else {
            void begin(s, email, true);
          }
        });
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: "error", message: "Impossible de charger la connexion. Vérifie ta connexion internet, puis réessaie." });
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
      sync.current?.stop();
    };
  }, [begin, attempt]);

  // Retour sur une liste après une édition : on affiche les données arrivées entre-temps.
  useEffect(() => {
    const onHash = () => {
      if (staleWhileEditing.current && !isEditing()) {
        staleWhileEditing.current = false;
        setDataVersion((v) => v + 1);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const c = cloud.current;
  switch (phase.kind) {
    case "loading":
      return <LoadingScreen label={phase.label} />;
    case "error":
      return (
        <ErrorScreen
          message={phase.message}
          onRetry={() => {
            setPhase({ kind: "loading", label: "Chargement…" });
            setAttempt((a) => a + 1);
          }}
        />
      );
    case "login":
      return (
        <LoginPage
          onSignIn={(e, p) => c!.signIn(e, p).catch((err) => Promise.reject(new Error(c!.authErrorMessage(err))))}
          onSignUp={(e, p) => c!.signUp(e, p).catch((err) => Promise.reject(new Error(c!.authErrorMessage(err))))}
          onReset={(e) => c!.resetPassword(e).catch((err) => Promise.reject(new Error(c!.authErrorMessage(err))))}
        />
      );
    case "import": {
      const s = sync.current!;
      return (
        <ImportPrompt
          email={phase.email}
          summary={phase.summary}
          error={phase.error}
          busy={phase.busy}
          onBackup={() => void downloadBackup()}
          onImport={async () => {
            setPhase({ ...phase, busy: true, error: null });
            try {
              await s.importLocal();
              await begin(s, phase.email, false);
            } catch (err) {
              setPhase({
                ...phase,
                busy: false,
                error: navigator.onLine ? cloudErrorMessage(err) : "Pas de connexion internet : reconnecte-toi puis réessaie.",
              });
            }
          }}
          onSkip={() => {
            s.discardLocal();
            void begin(s, phase.email, true);
          }}
        />
      );
    }
    case "ready":
      return <Fragment key={dataVersion}>{children}</Fragment>;
  }
}
