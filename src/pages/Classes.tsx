import { useEffect, useState } from "react";
import { ChevronRightIcon, LogInIcon, PlusIcon, Spinner, UsersIcon } from "../components/Icons";
import { MODE_INFO } from "../components/looks";
import { Modal, btn } from "../components/Modal";
import { useToast } from "../components/Toasts";
import { EmptyState, Page, PageHeader, Segmented, card, input } from "../components/ui";
import { goHome, openClasse } from "../hooks/useHashRoute";
import {
  classeErrorMessage,
  classesSupported,
  countNouveautes,
  createClasse,
  formatCode,
  getPrenom,
  joinClasse,
  listMesClasses,
  parseCode,
} from "../lib/classes";

/** Champ « Ton prénom » : c'est le nom que voient les autres membres (jamais l'adresse email). */
export function PrenomField({ value, onChange, id = "prenom" }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div>
      <label className="text-sm font-semibold" htmlFor={id}>
        Ton prénom
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 40))}
        autoComplete="given-name"
        placeholder="Ex. Léa"
        className={`${input} mt-1.5 h-12`}
      />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">C'est ce que verront les autres membres (pas ton adresse email).</p>
    </div>
  );
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState(getPrenom);
  const [qui, setQui] = useState<"tous" | "moi">("tous");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!nom.trim()) return setError("Donne un nom à ta classe.");
    if (!prenom.trim()) return setError("Écris ton prénom.");
    setBusy(true);
    setError(null);
    try {
      const code = await createClasse(nom, prenom, qui === "tous");
      toast.success(`Classe créée ! Donne le code ${formatCode(code)} aux autres pour qu'ils la rejoignent.`);
      openClasse(code);
    } catch (err) {
      setError(classeErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Créer une classe"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Annuler
          </button>
          <button type="button" className={btn.primary} onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <PlusIcon size={16} />} Créer la classe
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold" htmlFor="classe-nom">
            Nom de la classe
          </label>
          <input
            id="classe-nom"
            autoFocus
            value={nom}
            onChange={(e) => setNom(e.target.value.slice(0, 80))}
            placeholder="Ex. 3e B, ou Groupe de révision du bac"
            className={`${input} mt-1.5 h-12`}
          />
        </div>
        <PrenomField value={prenom} onChange={setPrenom} />
        <div>
          <p className="text-sm font-semibold">Qui peut ajouter des documents ?</p>
          <Segmented
            label="Qui peut ajouter des documents"
            value={qui}
            onChange={setQui}
            oneLine
            className="mt-1.5"
            options={[
              { value: "tous", label: "Tout le monde" },
              { value: "moi", label: "Moi seulement" },
            ]}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            « Moi seulement » convient à un prof qui partage ses cours. Tu pourras changer d'avis.
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function JoinForm({ onClose, initialCode = "" }: { onClose: () => void; initialCode?: string }) {
  const toast = useToast();
  const [code, setCode] = useState(initialCode ? formatCode(initialCode) : "");
  const [prenom, setPrenom] = useState(getPrenom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = parseCode(code);
    if (!parsed) return setError("Le code fait 8 caractères, par exemple ABCD-EF23. Vérifie-le avec la personne qui a créé la classe.");
    if (!prenom.trim()) return setError("Écris ton prénom.");
    setBusy(true);
    setError(null);
    try {
      const info = await joinClasse(parsed, prenom);
      toast.success(`Bienvenue dans « ${info.nom} » !`);
      openClasse(parsed);
      onClose();
    } catch (err) {
      setError(classeErrorMessage(err, "rejoindre"));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Rejoindre une classe"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Annuler
          </button>
          <button type="button" className={btn.primary} onClick={() => void submit()} disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <LogInIcon size={16} />} Rejoindre
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold" htmlFor="classe-code">
            Code de la classe
          </label>
          <input
            id="classe-code"
            autoFocus={!initialCode}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 60))}
            placeholder="ABCD-EF23"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={`${input} mt-1.5 h-12 font-mono text-lg tracking-widest`}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Demande-le à la personne qui a créé la classe (ou colle le lien d'invitation).
          </p>
        </div>
        <PrenomField value={prenom} onChange={setPrenom} id="prenom-rejoindre" />
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default function ClassesPage() {
  const info = MODE_INFO.classe;
  const [classes] = useState(listMesClasses);
  const [form, setForm] = useState<"creer" | "rejoindre" | null>(null);
  const [nouveautes, setNouveautes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!classesSupported) return;
    let cancelled = false;
    countNouveautes(classes)
      .then((n) => !cancelled && setNouveautes(n))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [classes]);

  return (
    <div className="min-h-dvh">
      <PageHeader title={info.label} onBack={goHome} backLabel="Retour à l'accueil" />
      <Page width="max-w-3xl">
        <section className="flex items-center gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 animate-pop items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg ${info.gradient} ${info.shadow}`}
          >
            {info.icon(28)}
          </span>
          <p className="text-balance text-slate-600 dark:text-slate-300">
            Crée une classe (ta classe, ou un groupe de révision entre amis) ou rejoins-en une avec son code. Tout ce qui y est partagé arrive chez
            chaque membre.
          </p>
        </section>

        {!classesSupported ? (
          <div className="mt-8">
            <EmptyState icon={<UsersIcon size={28} />} title="Le mode classe a besoin des comptes">
              Chaque membre doit avoir un compte ecoleduc. Active les comptes Firebase sur ce site (voir le README) pour utiliser le mode classe.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm("creer")}
                className={`flex min-h-20 items-center gap-4 rounded-2xl bg-linear-to-r p-4 text-left text-white shadow-lg transition hover:-translate-y-0.5 active:scale-[0.99] ${info.gradient} ${info.shadow}`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <PlusIcon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Créer une classe</span>
                  <span className="mt-0.5 block text-sm text-white/85">Tu obtiens un code à donner aux autres.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setForm("rejoindre")}
                className={`${card} flex min-h-20 items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${info.soft}`}>
                  <LogInIcon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Rejoindre avec un code</span>
                  <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">Le code que t'a donné ton prof ou un ami.</span>
                </span>
              </button>
            </div>

            <section className="mt-10" aria-labelledby="mes-classes">
              <h2 id="mes-classes" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                Mes classes {classes.length > 0 && <span className="ml-1 text-slate-400">({classes.length})</span>}
              </h2>
              {classes.length === 0 ? (
                <EmptyState
                  icon={<span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${info.soft}`}>{info.icon(24)}</span>}
                  title="Aucune classe"
                >
                  Crée la tienne ou rejoins celle de ton prof : les fiches, quiz et cartes partagés y apparaîtront.
                </EmptyState>
              ) : (
                <ul className={`${card} divide-y divide-slate-100 overflow-hidden dark:divide-slate-800`}>
                  {classes.map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => openClasse(c.code)}
                        className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white ${info.gradient}`}
                        >
                          <UsersIcon size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{c.nom}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {c.createur ? "Créée par toi" : "Membre"} · code {formatCode(c.code)}
                          </span>
                        </span>
                        {(nouveautes[c.code] ?? 0) > 0 && (
                          <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                            {nouveautes[c.code]} nouveau{nouveautes[c.code] > 1 ? "x" : ""}
                          </span>
                        )}
                        <ChevronRightIcon size={18} className="shrink-0 text-slate-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </Page>
      {form === "creer" && <CreateForm onClose={() => setForm(null)} />}
      {form === "rejoindre" && <JoinForm onClose={() => setForm(null)} />}
    </div>
  );
}
