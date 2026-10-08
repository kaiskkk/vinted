import { useState } from "react";
import { useSession, useSyncStatus } from "../lib/account";
import type { SyncStatus } from "../lib/sync";
import { CloudIcon, LogOutIcon, RefreshIcon, Spinner, UserIcon } from "./Icons";
import { Modal, btn } from "./Modal";

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function statusText(s: SyncStatus): { text: string; tone: "ok" | "busy" | "warn" | "error" } {
  if (s.state === "error") return { text: s.message ?? "La sauvegarde en ligne a échoué : nouvel essai bientôt.", tone: "error" };
  if (s.state === "offline") {
    return {
      text: s.pending
        ? "Hors connexion : tes modifications partiront dès le retour d'internet."
        : "Hors connexion : tout ce qui a été fait est déjà sauvegardé.",
      tone: "warn",
    };
  }
  if (s.state === "syncing" || s.pending) return { text: "Sauvegarde en cours…", tone: "busy" };
  return {
    text: s.lastSync ? `Tout est sauvegardé dans ton compte (${timeFormat.format(s.lastSync)}).` : "Tout est sauvegardé dans ton compte.",
    tone: "ok",
  };
}

/** Reste ouverte si l'accueil se recharge (données arrivées d'un autre appareil pendant la synchro). */
let keepOpen = false;

const DOT = { ok: "bg-emerald-500", busy: "bg-sky-500 animate-pulse", warn: "bg-amber-500", error: "bg-red-500" };

/** Bouton « compte » de l'accueil (seulement si les comptes sont activés). */
export function AccountButton() {
  const session = useSession();
  const status = useSyncStatus(session?.sync);
  const [open, setOpenState] = useState(() => keepOpen);
  const setOpen = (v: boolean) => {
    keepOpen = v;
    setOpenState(v);
  };
  const [leaving, setLeaving] = useState(false);
  if (!session || !status) return null;
  const { text, tone } = statusText(status);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 transition hover:-translate-y-px tap:h-11 tap:w-11 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
        aria-label={`Mon compte (${session.email}) : ${text}`}
        title={session.email}
      >
        <UserIcon size={18} />
        {tone !== "ok" && <span className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${DOT[tone]}`} aria-hidden="true" />}
      </button>
      {open && (
        <Modal
          title="Mon compte"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className={btn.secondary} onClick={() => setOpen(false)}>
                Fermer
              </button>
              <button
                type="button"
                className={btn.danger}
                disabled={leaving}
                onClick={async () => {
                  setLeaving(true);
                  await session.logout();
                  setLeaving(false);
                }}
              >
                {leaving ? <Spinner className="h-4 w-4" /> : <LogOutIcon size={16} />} Se déconnecter
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <UserIcon size={20} />
              </span>
              <span className="min-w-0 truncate font-medium">{session.email}</span>
            </p>
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60" role="status">
              <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
                <CloudIcon size={17} className="text-slate-500" />
                <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} aria-hidden="true" />
              </span>
              <span className="flex-1">{text}</span>
            </div>
            <button
              type="button"
              className={`${btn.secondary} w-full`}
              disabled={status.state === "syncing"}
              onClick={() => void session.sync.flush().then(() => session.sync.pull().catch(() => {}))}
            >
              <RefreshIcon size={15} /> Synchroniser maintenant
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tes cartes, documents, classeurs, ta série et ton niveau sont enregistrés dans ton compte : connecte-toi sur un autre appareil pour les
              retrouver. En te déconnectant, ils sont retirés de ce navigateur (ils restent dans ton compte).
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
