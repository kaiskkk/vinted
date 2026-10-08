import { useState, type FormEvent, type ReactNode } from "react";
import { CloudIcon, LockIcon, MailIcon, Spinner } from "../components/Icons";
import { btn } from "../components/Modal";
import { Segmented, card, input } from "../components/ui";

/** Fond et logo communs aux écrans de connexion. */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden px-4 py-10"
      style={{ paddingTop: "calc(2.5rem + var(--safe-top))", paddingBottom: "calc(2.5rem + var(--safe-bottom))" }}
    >
      <div
        className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[min(900px,180vw)] -translate-x-1/2 rounded-full bg-linear-to-br from-indigo-500/25 via-violet-500/15 to-fuchsia-500/20 blur-3xl dark:from-indigo-500/20 dark:via-violet-600/10 dark:to-fuchsia-600/15"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/icons/icon.svg" alt="" width={56} height={56} className="h-14 w-14 rounded-2xl shadow-lg shadow-indigo-500/30" />
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            <span className="bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">ecoleduc</span>
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <AuthScreen>
      <p className="flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400" aria-live="polite">
        <Spinner /> {label}
      </p>
    </AuthScreen>
  );
}

type Mode = "connexion" | "inscription";

export function LoginPage({
  onSignIn,
  onSignUp,
  onReset,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onReset: (email: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Écris ton adresse email.");
    if (password.length < 6) return setError("Le mot de passe doit faire au moins 6 caractères.");
    setBusy(true);
    try {
      await (mode === "connexion" ? onSignIn : onSignUp)(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La connexion a échoué.");
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Écris d'abord ton adresse email, puis touche à nouveau « Mot de passe oublié ».");
    setBusy(true);
    try {
      await onReset(email);
      setNotice(`Si un compte existe pour ${email.trim()}, un email pour choisir un nouveau mot de passe vient d'être envoyé (pense aux spams).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen>
      <form onSubmit={submit} className={`${card} space-y-4 p-5`} noValidate>
        <Segmented<Mode>
          label="Connexion ou inscription"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
            setNotice(null);
          }}
          oneLine
          options={[
            { value: "connexion", label: "Se connecter" },
            { value: "inscription", label: "Créer un compte" },
          ]}
        />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {mode === "connexion"
            ? "Retrouve tes cartes, fiches et révisions sur tous tes appareils."
            : "Gratuit, sans vérification d'email : il suffit d'une adresse et d'un mot de passe."}
        </p>
        <label className="block text-sm font-semibold">
          Adresse email
          <span className="relative mt-1.5 block">
            <MailIcon size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom@exemple.fr"
              className={`${input} h-12 pl-10 font-normal`}
            />
          </span>
        </label>
        <label className="block text-sm font-semibold">
          Mot de passe
          <span className="relative mt-1.5 block">
            <LockIcon size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type={show ? "text" : "password"}
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "connexion" ? "" : "6 caractères minimum"}
              className={`${input} h-12 pr-22 pl-10 font-normal`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute top-1/2 right-1.5 h-9 -translate-y-1/2 rounded-lg px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 tap:h-11 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-pressed={show}
            >
              {show ? "Masquer" : "Afficher"}
            </button>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-violet-600 px-5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />}
          {mode === "connexion" ? "Se connecter" : "Créer mon compte"}
        </button>
        {mode === "connexion" && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="mx-auto block min-h-10 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Mot de passe oublié ?
          </button>
        )}
      </form>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500 dark:text-slate-400">
        <CloudIcon size={14} /> Tes données sont sauvegardées dans ton compte.
      </p>
    </AuthScreen>
  );
}

export interface LocalSummary {
  cartes: number;
  documents: number;
  classeurs: number;
  jours: number;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

/** Première connexion sur un appareil qui contient déjà des données : les importer dans le compte ? */
export function ImportPrompt({
  email,
  summary,
  error,
  busy,
  onImport,
  onSkip,
  onBackup,
}: {
  email: string;
  summary: LocalSummary;
  error: string | null;
  busy: boolean;
  onImport: () => void;
  onSkip: () => void;
  onBackup: () => void;
}) {
  const [confirmSkip, setConfirmSkip] = useState(false);
  const parts = [
    summary.cartes && plural(summary.cartes, "carte mentale", "cartes mentales"),
    summary.documents && plural(summary.documents, "document"),
    summary.classeurs && plural(summary.classeurs, "classeur"),
    summary.jours && plural(summary.jours, "jour de révision", "jours de révision"),
  ].filter(Boolean);

  return (
    <AuthScreen>
      <div className={`${card} space-y-4 p-5`} role="dialog" aria-labelledby="import-titre">
        <h2 id="import-titre" className="text-lg font-bold">
          {confirmSkip ? "Commencer sans ces données ?" : "Importer les données de cet appareil ?"}
        </h2>
        {confirmSkip ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Elles seront retirées de ce navigateur et ton compte <strong>{email}</strong> restera tel quel. Pour les garder quelque part, télécharge
            d'abord une sauvegarde (tu pourras l'importer plus tard depuis l'accueil).
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Ce navigateur contient {parts.join(", ")} créés avant ta connexion. Les ajouter à ton compte <strong>{email}</strong> pour les retrouver
            partout ?
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        {confirmSkip ? (
          <div className="flex flex-col gap-2">
            <button type="button" className={btn.secondary} onClick={onBackup}>
              Télécharger une sauvegarde
            </button>
            <button type="button" className={btn.danger} onClick={onSkip} disabled={busy}>
              Continuer sans importer
            </button>
            <button type="button" className="min-h-10 text-sm font-medium text-slate-500" onClick={() => setConfirmSkip(false)}>
              Retour
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onImport}
              disabled={busy}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-violet-600 px-5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              {busy && <Spinner className="h-4 w-4" />} Oui, les importer
            </button>
            <button type="button" className={btn.secondary} onClick={() => setConfirmSkip(true)} disabled={busy}>
              Non merci
            </button>
          </div>
        )}
      </div>
    </AuthScreen>
  );
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <AuthScreen>
      <div className={`${card} space-y-4 p-5 text-center`} role="alert">
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <button type="button" className={btn.primary} onClick={onRetry}>
          Réessayer
        </button>
      </div>
    </AuthScreen>
  );
}
