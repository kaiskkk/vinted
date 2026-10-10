import { useEffect, useRef, useState, type ReactNode } from "react";
import { MODE_IDS, openMode, type Route } from "../hooks/useHashRoute";
import { accountsEnabled } from "../lib/account";
import { DERNIERE_VERSION, NOUVEAUTES, VUE_AU_DEMARRAGE, marquerVu, messageArrivee, nonVues, versionVue } from "../lib/nouveautes";
import { XIcon } from "./Icons";
import { MODE_INFO } from "./looks";
import { btn } from "./Modal";
import { Segmented } from "./ui";

type Onglet = "quoi" | "nouveautes";

// ---------- Ouverture du panneau, depuis n'importe où ----------

let state: { open: boolean; onglet: Onglet } = { open: false, onglet: "quoi" };
const listeners = new Set<() => void>();
const setState = (next: typeof state) => {
  state = next;
  listeners.forEach((l) => l());
};
export const openAPropos = (onglet: Onglet = "quoi") => setState({ open: true, onglet });
const closeAPropos = () => setState({ ...state, open: false });

function useAProposState() {
  const [s, setS] = useState(state);
  useEffect(() => {
    const l = () => setS(state);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}

/** Bouton « ? » en haut à droite de l'accueil, avec une pastille quand il y a des nouveautés pas encore lues. */
export function AProposButton() {
  const s = useAProposState();
  const [nouveau, setNouveau] = useState(() => versionVue() !== DERNIERE_VERSION);
  useEffect(() => {
    if (s.open) setNouveau(false);
  }, [s.open]);
  return (
    <button
      type="button"
      onClick={() => openAPropos(nouveau ? "nouveautes" : "quoi")}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-base font-bold text-slate-600 transition hover:-translate-y-px hover:text-slate-900 tap:h-11 tap:w-11 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
      aria-label={nouveau ? "ecoleduc, c'est quoi ? (nouveautés à lire)" : "ecoleduc, c'est quoi ?"}
      title="ecoleduc, c'est quoi ? et les nouveautés"
    >
      ?
      {nouveau && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-slate-900" aria-hidden="true" />
      )}
    </button>
  );
}

// ---------- Message d'arrivée, en haut à droite ----------

/** À l'arrivée sur le site : un petit message de bienvenue, ou l'annonce de la dernière mise à jour. */
export function ArriveeMessage({ route }: { route: Route }) {
  const [message] = useState(() => messageArrivee());
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    // Seulement sur l'accueil : ailleurs, il cacherait les boutons de la page (il attend le retour à l'accueil).
    if (route.page !== "home") {
      setVisible(false);
      return;
    }
    if (!message || shown.current) return;
    shown.current = true;
    marquerVu();
    setVisible(true);
  }, [message, route.page]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 15_000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible || !message) return null;
  const maj = message.kind === "maj" ? message.maj : [];
  return (
    <div
      role="status"
      className="no-print fixed right-3 z-40 w-[min(calc(100vw-1.5rem),360px)] animate-slide-down rounded-2xl border border-indigo-200 bg-white/97 p-4 shadow-2xl shadow-indigo-500/20 backdrop-blur dark:border-indigo-500/30 dark:bg-slate-900/97"
      style={{ top: "calc(4rem + var(--safe-top))" }}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          {message.kind === "bienvenue" ? "👋" : "🎉"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{message.kind === "bienvenue" ? "Bienvenue sur ecoleduc !" : "Le site a été mis à jour"}</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            {message.kind === "bienvenue"
              ? "Ajoute ton cours : l'IA prépare tes fiches, quiz, flashcards et bien plus. Tout est gratuit."
              : maj.length > 1
                ? `${maj.length} nouveautés, dont « ${maj[0].titre} ».`
                : `Nouveau : ${maj[0].titre}.`}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex min-h-10 items-center rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98] tap:min-h-11"
            onClick={() => {
              setVisible(false);
              openAPropos(message.kind === "bienvenue" ? "quoi" : "nouveautes");
            }}
          >
            {message.kind === "bienvenue" ? "Découvrir ecoleduc" : "Voir les nouveautés"}
          </button>
        </div>
        <button type="button" className={`${btn.icon} -mt-1 -mr-1`} onClick={() => setVisible(false)} aria-label="Fermer le message">
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------- Panneau à droite ----------

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">{titre}</h3>
      {children}
    </section>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{q}</span>
        <span className="text-slate-400 transition group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="pb-3 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </details>
  );
}

function CestQuoi({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <p className="text-slate-700 dark:text-slate-200">
        <strong>ecoleduc</strong> t'aide à <strong>apprendre et réviser tes cours</strong>. Tu donnes ton cours (texte, PDF, photo de ton cahier ou un
        simple sujet) et l'IA prépare pour toi des fiches, des quiz, des flashcards, des exercices… Tu peux tout modifier, tout imprimer, et réviser
        sur ordinateur comme sur téléphone. <strong>C'est gratuit.</strong>
      </p>

      <Section titre="Comment ça marche">
        <ol className="space-y-2 text-sm">
          {[
            ["1", "Choisis ton niveau en haut de l'accueil (collège, lycée, études sup)."],
            ["2", "Ouvre « Général » et crée un classeur avec ton cours, ou va directement dans un mode (Fiches, Quiz…)."],
            ["3", "Touche ce que tu veux préparer : l'IA le crée en quelques secondes."],
            ["4", "Révise : quiz, flashcards, oral, jeux… Chaque jour de révision allonge ta série 🔥."],
          ].map(([n, t]) => (
            <li key={n} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {n}
              </span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section titre="Tout ce que tu peux faire">
        <ul className="grid gap-1.5">
          {MODE_IDS.map((m) => {
            const info = MODE_INFO[m];
            return (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openMode(m);
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white ${info.gradient}`}>
                    {info.icon(18)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{info.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{info.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section titre="Partout dans le site">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
          <li>
            <strong>💡 Plus simple</strong> : sur un passage que tu ne comprends pas, l'IA te le réexplique avec des mots de tous les jours.
          </li>
          <li>
            <strong>🔊 Écouter</strong> : le site lit tes documents à voix haute. <strong>🎤 Micro</strong> : dicte au lieu d'écrire.
          </li>
          <li>
            <strong>⏱️ Minuteur</strong> : 25 minutes de révision concentrée, puis une pause.
          </li>
          <li>
            <strong>🔗 Partager</strong> : envoie une copie d'un document à un ami, ou à toute ta classe.
          </li>
          <li>
            <strong>🖨️ Imprimer / PDF</strong> : fiches, exercices et frises sortent proprement sur une feuille A4.
          </li>
        </ul>
      </Section>

      <Section titre="Bon à savoir">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
          <li>L'IA peut se tromper : en cas de doute, vérifie avec ton cours ou ton prof.</li>
          <li>Pour les devoirs, elle te guide (plan, idées, relecture) mais ne les écrit jamais à ta place.</li>
          <li>
            {accountsEnabled
              ? "Tes données sont rangées dans ton compte : tu les retrouves sur tous tes appareils, et personne d'autre ne peut les voir."
              : "Tes données restent dans ce navigateur : pense à « Sauvegarder tout » de temps en temps."}
          </li>
          <li>Le site marche sans connexion (sauf l'IA), et s'installe comme une appli sur ton téléphone.</li>
        </ul>
      </Section>

      <Section titre="Questions fréquentes">
        <div className="space-y-2">
          <Faq q="C'est vraiment gratuit ?">Oui. L'IA utilisée (Google Gemini) a une offre gratuite, et le site ne contient aucune publicité.</Faq>
          <Faq q="Pourquoi l'IA met parfois du temps ?">
            Elle prépare tout ton document d'un coup : compte quelques secondes. Si elle est surchargée, un message s'affiche avec un bouton «
            Réessayer ».
          </Faq>
          <Faq q="Comment installer l'appli sur mon téléphone ?">
            Sur iPhone : bouton Partager de Safari, puis « Sur l'écran d'accueil ». Sur Android : bouton « Installer l'appli » de l'accueil, ou menu ⋮
            puis « Installer l'application ».
          </Faq>
          <Faq q="Le micro ou la voix ne marchent pas">
            Autorise le micro pour le site dans les réglages du navigateur. La dictée marche avec Chrome, Edge et Safari ; sur Firefox, écris au
            clavier.
          </Faq>
          <Faq q="Comment rejoindre la classe de mon prof ?">
            Ouvre « Ma classe », touche « Rejoindre avec un code » et entre le code qu'il t'a donné.
          </Faq>
          <Faq q="Ce que je partage, les autres peuvent le modifier ?">
            Non : chacun reçoit sa propre copie. Tes réponses, tes scores et tes brouillons ne sont jamais partagés.
          </Faq>
        </div>
      </Section>
    </div>
  );
}

function Nouveautes() {
  // Ce qui était nouveau à l'ouverture du site (le message d'arrivée l'a peut-être déjà marqué comme vu).
  const [aLire] = useState(() => new Set(nonVues(VUE_AU_DEMARRAGE).map((n) => n.version)));
  return (
    <ol className="space-y-4">
      {NOUVEAUTES.map((n) => (
        <li key={n.version} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {n.date}
            {(aLire.has(n.version) || n.version === DERNIERE_VERSION) && (
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
                {aLire.has(n.version) ? "Nouveau" : "Dernière"}
              </span>
            )}
          </p>
          <h3 className="mt-1 font-bold">{n.titre}</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {n.points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** Panneau qui glisse depuis la droite : « ecoleduc, c'est quoi ? » et les nouveautés. */
export function AProposPanel() {
  const s = useAProposState();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!s.open) return;
    marquerVu();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAPropos();
    window.addEventListener("keydown", onKey);
    // Changer de page ferme le panneau.
    window.addEventListener("hashchange", closeAPropos);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", closeAPropos);
    };
  }, [s.open]);

  if (!s.open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-[2px]" onClick={closeAPropos} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="ecoleduc, c'est quoi ?"
        className="relative flex h-full w-[min(100vw,440px)] animate-drawer-in flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#11162a]"
        style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)", paddingRight: "var(--safe-right)" }}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <img src="/icons/icon.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">ecoleduc, c'est quoi ?</h2>
          <button ref={closeRef} type="button" className={btn.icon} onClick={closeAPropos} aria-label="Fermer">
            <XIcon size={18} />
          </button>
        </div>
        <div className="px-4 pt-3">
          <Segmented
            label="Rubrique"
            value={s.onglet}
            onChange={(onglet) => setState({ ...state, onglet })}
            oneLine
            options={[
              { value: "quoi", label: "Tout savoir" },
              { value: "nouveautes", label: "Nouveautés" },
            ]}
          />
        </div>
        <div className="mm-scroll flex-1 overflow-y-auto px-4 pt-4 pb-8">
          {s.onglet === "quoi" ? <CestQuoi onClose={closeAPropos} /> : <Nouveautes />}
        </div>
      </aside>
    </div>
  );
}
