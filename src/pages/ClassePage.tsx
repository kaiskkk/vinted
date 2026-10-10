import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  LogInIcon,
  LogOutIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  ShareIcon,
  Spinner,
  TrashIcon,
  UsersIcon,
} from "../components/Icons";
import { KIND_LOOK, KindBadge, MODE_INFO } from "../components/looks";
import { Modal, btn } from "../components/Modal";
import { useToast } from "../components/Toasts";
import { EmptyState, Page, PageHeader, card, input } from "../components/ui";
import { openItem, openMode } from "../hooks/useHashRoute";
import {
  classeErrorMessage,
  classesSupported,
  deleteClasse,
  deleteDocument,
  fetchClasse,
  formatCode,
  getMaClasse,
  getPrenom,
  importFromClasse,
  inviteUrl,
  joinClasse,
  leaveClasse,
  listDocuments,
  listMembres,
  myUid,
  removeMaClasse,
  removeMembre,
  saveMaClasse,
  shareToClasse,
  updateClasse,
  type ClasseDocument,
  type ClasseInfo,
  type ClasseMembre,
} from "../lib/classes";
import { loadClasseur, loadDoc } from "../lib/docs";
import { fold, formatDate } from "../lib/format";
import { listLibrary, type ItemKind } from "../lib/library";
import { loadMap } from "../lib/storage";
import { PrenomField } from "./Classes";

type State =
  | { kind: "loading" }
  | { kind: "join" }
  | { kind: "gone"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; info: ClasseInfo; membres: ClasseMembre[]; documents: ClasseDocument[]; uid: string | null; vuAvant: number };

const existsLocally = (kind: ItemKind, id: string) =>
  kind === "carte" ? loadMap(id) !== null : kind === "classeur" ? loadClasseur(id) !== null : loadDoc(id) !== null;

interface Confirm {
  title: string;
  text: string;
  label: string;
  run: () => Promise<void>;
}

export default function ClassePage({ code }: { code: string }) {
  const info = MODE_INFO.classe;
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!classesSupported) {
      setState({ kind: "error", message: "Le mode classe a besoin des comptes ecoleduc, qui ne sont pas activés sur ce site." });
      return;
    }
    try {
      const classe = await fetchClasse(code);
      if (!classe) {
        removeMaClasse(code);
        setState({ kind: "gone", message: "Cette classe n'existe plus : son créateur l'a peut-être supprimée." });
        return;
      }
      const [membres, documents, uid] = await Promise.all([listMembres(code), listDocuments(code), myUid()]);
      const mine = getMaClasse(code);
      const latest = documents.reduce((m, d) => Math.max(m, d.createdAt), 0);
      saveMaClasse({
        code,
        nom: classe.nom,
        createur: classe.proprietaire === uid,
        peutPartager: classe.proprietaire === uid || classe.tousPartagent,
        rejointLe: mine?.rejointLe ?? Date.now(),
        updatedAt: Date.now(),
        vu: Math.max(mine?.vu ?? 0, latest),
        imports: mine?.imports ?? {},
      });
      setState({ kind: "ok", info: classe, membres, documents, uid, vuAvant: mine?.vu ?? latest });
    } catch (err) {
      if ((err as { code?: string })?.code === "permission-denied") {
        if (getMaClasse(code)) {
          removeMaClasse(code);
          setState({ kind: "gone", message: "Tu ne fais plus partie de cette classe : son créateur t'en a peut-être retiré." });
        } else setState({ kind: "join" });
        return;
      }
      setState({ kind: "error", message: classeErrorMessage(err, "ouvrir") });
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.run();
      setConfirm(null);
    } catch (err) {
      toast.error(classeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const header = (subtitle?: string) => (
    <PageHeader
      title={state.kind === "ok" ? state.info.nom : "Classe"}
      subtitle={subtitle}
      onBack={() => openMode("classe")}
      backLabel="Mes classes"
      width="max-w-3xl"
      actions={
        state.kind === "ok" && (
          <button type="button" className={btn.icon} onClick={() => void load()} aria-label="Actualiser" title="Actualiser">
            <RefreshIcon size={17} />
          </button>
        )
      }
    />
  );

  if (state.kind === "loading") {
    return (
      <div className="min-h-dvh">
        {header()}
        <p className="flex items-center justify-center gap-3 py-16 text-slate-500 dark:text-slate-400" aria-live="polite">
          <Spinner /> Ouverture de la classe…
        </p>
      </div>
    );
  }

  if (state.kind === "join") return <JoinCard code={code} header={header()} onJoined={() => void load()} />;

  if (state.kind === "gone" || state.kind === "error") {
    return (
      <div className="min-h-dvh">
        {header()}
        <Page width="max-w-xl">
          <div className={`${card} p-6 text-center`} role="alert">
            <p className="text-slate-700 dark:text-slate-200">{state.message}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {state.kind === "error" && (
                <button type="button" className={btn.primary} onClick={() => void load()}>
                  <RefreshIcon size={15} /> Réessayer
                </button>
              )}
              <button type="button" className={btn.secondary} onClick={() => openMode("classe")}>
                Mes classes
              </button>
            </div>
          </div>
        </Page>
      </div>
    );
  }

  const { info: classe, membres, documents, uid, vuAvant } = state;
  const createur = classe.proprietaire === uid;
  const peutPartager = createur || classe.tousPartagent;
  const nomDe = (id: string) => membres.find((m) => m.uid === id)?.nom;

  const open = (d: ClasseDocument) => {
    try {
      const copy = importFromClasse(code, d, existsLocally);
      openItem(copy.kind, copy.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ouverture impossible.");
    }
  };

  return (
    <div className="min-h-dvh">
      {header(`Ma classe · ${membres.length} membre${membres.length > 1 ? "s" : ""}`)}
      <Page width="max-w-3xl">
        <CodeCard code={code} nom={classe.nom} ouverte={classe.ouverte} />

        <section className="mt-8" aria-labelledby="docs-classe">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 id="docs-classe" className="mr-auto text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Documents partagés {documents.length > 0 && <span className="ml-1 text-slate-400">({documents.length})</span>}
            </h2>
            {peutPartager && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-linear-to-r px-4 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] ${info.gradient} ${info.shadow}`}
              >
                <PlusIcon size={16} /> Ajouter un document
              </button>
            )}
          </div>
          {!peutPartager && (
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Dans cette classe, seul le créateur ajoute des documents.</p>
          )}
          {documents.length === 0 ? (
            <EmptyState
              icon={<span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${info.soft}`}>{info.icon(24)}</span>}
              title="Rien pour l'instant"
            >
              {peutPartager
                ? "Ajoute une fiche, un quiz, une carte mentale ou un classeur : il apparaîtra chez tous les membres."
                : "Les documents partagés par le créateur de la classe apparaîtront ici."}
            </EmptyState>
          ) : (
            <ul className={`${card} divide-y divide-slate-100 overflow-hidden dark:divide-slate-800`}>
              {documents.map((d) => {
                const mine = getMaClasse(code)?.imports[d.id];
                const added = Boolean(mine && existsLocally(mine.kind, mine.id));
                const isNew = d.createdAt > vuAvant && d.auteur !== uid;
                const canDelete = createur || d.auteur === uid;
                return (
                  <li key={d.id} className="flex items-center gap-1 pr-1.5">
                    <button
                      type="button"
                      onClick={() => open(d)}
                      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 sm:px-4 dark:hover:bg-slate-800/60"
                    >
                      <KindBadge kind={d.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{d.titre || "Sans titre"}</span>
                          {isNew && <span className="shrink-0 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white">Nouveau</span>}
                        </span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {KIND_LOOK[d.kind].label} · par {d.auteur === uid ? "toi" : nomDe(d.auteur) || d.auteurNom || "un membre"} ·{" "}
                          {formatDate(d.createdAt)}
                          {added && " · dans tes documents"}
                        </span>
                      </span>
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className={`${btn.icon} hover:text-red-600`}
                        aria-label={`Retirer « ${d.titre} » de la classe`}
                        title="Retirer de la classe"
                        onClick={() =>
                          setConfirm({
                            title: "Retirer ce document ?",
                            text: `« ${d.titre} » ne sera plus visible dans la classe. Les copies déjà ajoutées par les membres restent chez eux.`,
                            label: "Retirer",
                            run: async () => {
                              await deleteDocument(code, d.id);
                              await load();
                              toast.success("Document retiré de la classe.");
                            },
                          })
                        }
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {documents.length > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Touche un document pour l'ouvrir : il est ajouté à tes documents, et tes réponses et scores restent à toi.
            </p>
          )}
        </section>

        <section className="mt-8" aria-labelledby="membres-classe">
          <h2 id="membres-classe" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Membres <span className="ml-1 text-slate-400">({membres.length})</span>
          </h2>
          <ul className={`${card} divide-y divide-slate-100 overflow-hidden dark:divide-slate-800`}>
            {membres.map((m) => (
              <li key={m.uid} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${info.soft}`} aria-hidden="true">
                  {m.nom.charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {m.nom}
                  {m.uid === uid && <span className="font-normal text-slate-500 dark:text-slate-400"> (toi)</span>}
                </span>
                {m.uid === classe.proprietaire && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    Créateur
                  </span>
                )}
                {createur && m.uid !== uid && (
                  <button
                    type="button"
                    className={`${btn.icon} hover:text-red-600`}
                    aria-label={`Retirer ${m.nom} de la classe`}
                    title="Retirer de la classe"
                    onClick={() =>
                      setConfirm({
                        title: `Retirer ${m.nom} ?`,
                        text: `${m.nom} n'aura plus accès aux documents de la classe. Il pourra la rejoindre à nouveau avec le code tant que les inscriptions sont ouvertes.`,
                        label: "Retirer",
                        run: async () => {
                          await removeMembre(code, m.uid);
                          await load();
                        },
                      })
                    }
                  >
                    <TrashIcon size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {createur ? (
          <Reglages
            classe={classe}
            onChange={async (patch) => {
              try {
                await updateClasse(code, patch);
                toast.success("Réglage enregistré.");
                await load();
                return true;
              } catch (err) {
                toast.error(classeErrorMessage(err));
                return false;
              }
            }}
            onDelete={() =>
              setConfirm({
                title: "Supprimer la classe ?",
                text: "La classe, ses documents partagés et la liste des membres seront supprimés pour tout le monde. Les copies déjà ajoutées par chacun restent dans ses documents.",
                label: "Supprimer la classe",
                run: async () => {
                  await deleteClasse(code);
                  toast.success("Classe supprimée.");
                  openMode("classe");
                },
              })
            }
          />
        ) : (
          <section className="mt-8">
            <button
              type="button"
              className={`${btn.secondary} w-full text-red-600 sm:w-auto dark:text-red-400`}
              onClick={() =>
                setConfirm({
                  title: "Quitter la classe ?",
                  text: "Tu n'auras plus accès aux documents partagés. Ceux que tu as déjà ajoutés restent dans tes documents.",
                  label: "Quitter",
                  run: async () => {
                    await leaveClasse(code);
                    toast.success("Tu as quitté la classe.");
                    openMode("classe");
                  },
                })
              }
            >
              <LogOutIcon size={16} /> Quitter la classe
            </button>
          </section>
        )}
      </Page>

      {adding && (
        <AddDocument
          onClose={() => setAdding(false)}
          onPick={async (kind, id) => {
            await shareToClasse(code, kind, id);
            setAdding(false);
            toast.success("Envoyé à la classe : chaque membre peut maintenant l'ouvrir.");
            await load();
          }}
        />
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => !busy && setConfirm(null)}
          footer={
            <>
              <button type="button" className={btn.secondary} onClick={() => setConfirm(null)} disabled={busy}>
                Annuler
              </button>
              <button type="button" className={btn.danger} onClick={() => void runConfirm()} disabled={busy}>
                {busy && <Spinner className="h-4 w-4" />} {confirm.label}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">{confirm.text}</p>
        </Modal>
      )}
    </div>
  );
}

// ---------- Rejoindre depuis un lien d'invitation ----------

function JoinCard({ code, header, onJoined }: { code: string; header: React.ReactNode; onJoined: () => void }) {
  const info = MODE_INFO.classe;
  const toast = useToast();
  const [prenom, setPrenom] = useState(getPrenom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const join = async () => {
    if (!prenom.trim()) return setError("Écris ton prénom.");
    setBusy(true);
    setError(null);
    try {
      const classe = await joinClasse(code, prenom);
      toast.success(`Bienvenue dans « ${classe.nom} » !`);
      onJoined();
    } catch (err) {
      setError(classeErrorMessage(err, "rejoindre"));
      setBusy(false);
    }
  };
  return (
    <div className="min-h-dvh">
      {header}
      <Page width="max-w-xl">
        <div className={`${card} animate-pop p-6`}>
          <div className="flex justify-center">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg ${info.gradient} ${info.shadow}`}
            >
              <UsersIcon size={28} />
            </span>
          </div>
          <h1 className="mt-3 text-center text-xl font-bold">Rejoindre la classe</h1>
          <p className="mt-1 text-center text-sm text-slate-600 dark:text-slate-300">
            Code <strong className="font-mono tracking-wider">{formatCode(code)}</strong>. Tu verras les documents partagés par la classe.
          </p>
          <div className="mt-5">
            <PrenomField value={prenom} onChange={setPrenom} id="prenom-invitation" />
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void join()}
            disabled={busy}
            className={`mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 ${info.gradient} ${info.shadow}`}
          >
            {busy ? <Spinner className="h-4 w-4" /> : <LogInIcon size={18} />} Rejoindre la classe
          </button>
        </div>
      </Page>
    </div>
  );
}

// ---------- Code et invitation ----------

function CodeCard({ code, nom, ouverte }: { code: string; nom: string; ouverte: boolean }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(message);
    } catch {
      toast.info(`Recopie-le à la main : ${text}`);
    }
  };
  const invite = async () => {
    const url = inviteUrl(code);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: nom, text: `Rejoins la classe « ${nom} » sur ecoleduc (code ${formatCode(code)})`, url });
        return;
      } catch {
        // Partage annulé : on propose de copier le lien.
      }
    }
    await copy(url, "Lien d'invitation copié : envoie-le aux membres.");
  };
  return (
    <section className={`${card} p-5`} aria-label="Code de la classe">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Code de la classe</p>
      <p className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] tabular-nums select-all">{formatCode(code)}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {ouverte
          ? "Donne ce code (ou le lien) aux autres : ils rejoignent la classe depuis « Ma classe »."
          : "Les nouvelles inscriptions sont fermées."}
      </p>
      {ouverte && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} onClick={() => void copy(formatCode(code), "Code copié.")}>
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />} Copier le code
          </button>
          <button type="button" className={btn.secondary} onClick={() => void invite()}>
            <ShareIcon size={16} /> Inviter avec un lien
          </button>
        </div>
      )}
    </section>
  );
}

// ---------- Réglages (créateur) ----------

function Reglages({
  classe,
  onChange,
  onDelete,
}: {
  classe: ClasseInfo;
  onChange: (patch: Partial<{ nom: string; ouverte: boolean; tousPartagent: boolean }>) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [nom, setNom] = useState(classe.nom);
  // Cochée tout de suite, décochée si l'enregistrement échoue.
  const [ouverte, setOuverte] = useState(classe.ouverte);
  const [tousPartagent, setTousPartagent] = useState(classe.tousPartagent);
  useEffect(() => setOuverte(classe.ouverte), [classe.ouverte]);
  useEffect(() => setTousPartagent(classe.tousPartagent), [classe.tousPartagent]);
  const setFlag = async (key: "ouverte" | "tousPartagent", value: boolean) => {
    const set = key === "ouverte" ? setOuverte : setTousPartagent;
    set(value);
    if (!(await onChange({ [key]: value }))) set(!value);
  };
  const toggle = "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60";
  return (
    <section className="mt-8" aria-labelledby="reglages-classe">
      <h2 id="reglages-classe" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
        Réglages
      </h2>
      <div className={`${card} space-y-3 p-4`}>
        <div>
          <label className="text-sm font-semibold" htmlFor="classe-renommer">
            Nom de la classe
          </label>
          <div className="mt-1.5 flex gap-2">
            <input id="classe-renommer" value={nom} onChange={(e) => setNom(e.target.value.slice(0, 80))} className={`${input} h-11 flex-1`} />
            <button
              type="button"
              className={btn.secondary}
              disabled={!nom.trim() || nom.trim() === classe.nom}
              onClick={() => void onChange({ nom: nom.trim() })}
            >
              Renommer
            </button>
          </div>
        </div>
        <label className={toggle}>
          <input type="checkbox" checked={ouverte} onChange={(e) => void setFlag("ouverte", e.target.checked)} className="h-5 w-5 accent-green-600" />
          <span className="text-sm font-medium">Accepter de nouveaux membres avec le code</span>
        </label>
        <label className={toggle}>
          <input
            type="checkbox"
            checked={tousPartagent}
            onChange={(e) => void setFlag("tousPartagent", e.target.checked)}
            className="h-5 w-5 accent-green-600"
          />
          <span className="text-sm font-medium">Tous les membres peuvent ajouter des documents</span>
        </label>
        <button type="button" className={`${btn.secondary} text-red-600 dark:text-red-400`} onClick={onDelete}>
          <TrashIcon size={16} /> Supprimer la classe
        </button>
      </div>
    </section>
  );
}

// ---------- Choisir un document à envoyer ----------

function AddDocument({ onClose, onPick }: { onClose: () => void; onPick: (kind: ItemKind, id: string) => Promise<void> }) {
  const toast = useToast();
  const [items] = useState(listLibrary);
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const shown = useMemo(() => {
    const q = fold(query.trim());
    return q ? items.filter((i) => fold(i.titre).includes(q)) : items;
  }, [items, query]);
  const pick = async (kind: ItemKind, id: string) => {
    setSending(id);
    try {
      await onPick(kind, id);
    } catch (err) {
      toast.error(classeErrorMessage(err, "partager"));
      setSending(null);
    }
  };
  return (
    <Modal
      title="Ajouter à la classe"
      onClose={onClose}
      footer={
        <button type="button" className={btn.secondary} onClick={onClose}>
          Fermer
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Tu n'as encore aucun document : crée une fiche, un quiz ou une carte, puis reviens ici.
        </p>
      ) : (
        <>
          <label className="relative block">
            <span className="sr-only">Rechercher</span>
            <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className={`${input} h-11 pl-9`}
            />
          </label>
          <ul className="mt-3 max-h-[50dvh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {shown.map((i) => (
              <li key={`${i.kind}-${i.id}`}>
                <button
                  type="button"
                  disabled={sending !== null}
                  onClick={() => void pick(i.kind, i.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-800/60"
                >
                  <KindBadge kind={i.kind} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{i.titre}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {KIND_LOOK[i.kind].label} · {i.info}
                    </span>
                  </span>
                  {sending === i.id ? <Spinner className="h-4 w-4" /> : <PlusIcon size={16} className="shrink-0 text-slate-400" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Une copie est envoyée, sans tes réponses, scores ni brouillons.</p>
        </>
      )}
    </Modal>
  );
}
