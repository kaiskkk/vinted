import { useState } from "react";
import { ChevronRightIcon, FolderIcon, PencilIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { KindBadge, MODE_INFO } from "../components/looks";
import { Modal, btn } from "../components/Modal";
import { SourcePicker, emptySource, hasSource, type SourceValue } from "../components/SourcePicker";
import { useToast } from "../components/Toasts";
import { EmptyState, Page, PageHeader, card, input } from "../components/ui";
import { goHome, openClasseur } from "../hooks/useHashRoute";
import { createClasseur, docsOfClasseur, listClasseurs, loadClasseur, mapIdsOfClasseur, saveClasseur, type ClasseurSummary } from "../lib/docs";
import { formatDate, plural } from "../lib/format";
import { deleteClasseurDeep, restore } from "../lib/library";
import { loadMap } from "../lib/storage";

/** Nombre d'éléments rangés dans un classeur (documents et cartes encore présentes). */
export function classeurCount(id: string) {
  return docsOfClasseur(id).length + mapIdsOfClasseur(id).filter((m) => loadMap(m)).length;
}

/** Nom proposé à partir du cours : sa première ligne, ou le sujet. */
export function guessName(source: SourceValue): string {
  const first = source.cours
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 2);
  const fromFile = source.fichiers[0]?.replace(/\.[a-z0-9]+$/i, "");
  return (source.sujet.trim() || first || fromFile || "Nouveau classeur").slice(0, 80);
}

/** Création ou modification d'un classeur : nom + cours (collé, sujet ou fichiers). */
export function ClasseurForm({
  title,
  initialNom = "",
  initialSource = emptySource(),
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  initialNom?: string;
  initialSource?: SourceValue;
  submitLabel: string;
  onSubmit: (nom: string, source: SourceValue) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [nom, setNom] = useState(initialNom);
  const [source, setSource] = useState<SourceValue>(initialSource);
  const info = MODE_INFO.general;

  return (
    <div className="min-h-dvh">
      <PageHeader title={title} onBack={onCancel} backLabel="Annuler" width="max-w-3xl" />
      <Page width="max-w-3xl">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">1. Ajoute ton cours</h2>
            <SourcePicker value={source} onChange={setSource} onError={(m) => toast.error(m)} />
          </section>
          <section>
            <label className="block text-sm font-semibold" htmlFor="nom-classeur">
              2. Donne-lui un nom <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
            </label>
            <input
              id="nom-classeur"
              value={nom}
              onChange={(e) => setNom(e.target.value.slice(0, 120))}
              placeholder={hasSource(source) ? guessName(source) : "Ex. SVT — Les volcans"}
              enterKeyHint="done"
              className={`${input} mt-2 h-12`}
            />
          </section>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
            <button type="button" className={btn.secondary} onClick={onCancel}>
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                if (!hasSource(source)) return toast.error("Ajoute d'abord ton cours, un fichier ou un sujet.");
                onSubmit(nom.trim() || guessName(source), source);
              }}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] ${info.gradient} ${info.shadow}`}
            >
              <FolderIcon size={18} /> {submitLabel}
            </button>
          </div>
        </div>
      </Page>
    </div>
  );
}

export default function General() {
  const toast = useToast();
  const info = MODE_INFO.general;
  const [classeurs, setClasseurs] = useState<ClasseurSummary[]>(listClasseurs);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [toDelete, setToDelete] = useState<ClasseurSummary | null>(null);
  const refresh = () => setClasseurs(listClasseurs());

  if (creating) {
    return (
      <ClasseurForm
        title="Nouveau classeur"
        submitLabel="Créer le classeur"
        onCancel={() => setCreating(false)}
        onSubmit={(nom, source) => {
          try {
            const c = createClasseur({ nom, cours: source.cours, sujet: source.sujet, fichiers: source.fichiers });
            openClasseur(c.id);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Création impossible.");
          }
        }}
      />
    );
  }

  const commitRename = () => {
    if (!renaming) return;
    const c = loadClasseur(renaming.id);
    if (c && renaming.value.trim()) saveClasseur({ ...c, nom: renaming.value.trim(), updatedAt: Date.now() });
    setRenaming(null);
    refresh();
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const snap = deleteClasseurDeep(toDelete.id);
    toast.success(`Classeur supprimé : « ${toDelete.nom} ».`, {
      label: "Annuler",
      onClick: () => {
        restore(snap);
        refresh();
      },
    });
    setToDelete(null);
    refresh();
  };

  return (
    <div className="min-h-dvh">
      <PageHeader title="Général" onBack={goHome} backLabel="Retour à l'accueil" />
      <Page>
        <section className="flex items-center gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 animate-pop items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg ${info.gradient} ${info.shadow}`}
          >
            {info.icon(28)}
          </span>
          <p className="text-balance text-slate-600 dark:text-slate-300">
            Ajoute ton cours une seule fois : l'IA en tire une carte mentale, une fiche, une fiche de révision, un quiz, des flashcards et un résumé.
            Tout est rangé dans un classeur, avec une discussion pour poser tes questions.
          </p>
        </section>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`group mt-6 flex min-h-20 w-full items-center gap-4 rounded-2xl bg-linear-to-r p-4 text-left text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99] ${info.gradient} ${info.shadow}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <PlusIcon size={24} strokeWidth={2.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Nouveau classeur</span>
            <span className="block text-sm text-white/85">Colle ton cours, écris un sujet, ou importe un PDF ou une photo.</span>
          </span>
          <ChevronRightIcon size={20} className="shrink-0 text-white/80 transition group-hover:translate-x-0.5" />
        </button>

        <section className="mt-10" aria-labelledby="mes-classeurs">
          <h2 id="mes-classeurs" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Mes classeurs {classeurs.length > 0 && <span className="ml-1 text-slate-400 dark:text-slate-500">({classeurs.length})</span>}
          </h2>
          {classeurs.length === 0 ? (
            <EmptyState icon={<KindBadge kind="classeur" size="lg" />} title="Aucun classeur pour l'instant">
              Crée ton premier classeur avec le cours que tu révises en ce moment.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {classeurs.map((c) => (
                <li key={c.id} className={`${card} group flex items-center gap-1 pr-1.5 transition hover:shadow-md`}>
                  {renaming?.id === c.id ? (
                    <div className="flex min-h-20 flex-1 items-center gap-3 px-4">
                      <KindBadge kind="classeur" />
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        maxLength={120}
                        aria-label="Nouveau nom"
                        className="h-11 min-w-0 flex-1 rounded-lg border border-indigo-400 bg-transparent px-2 text-base font-semibold outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openClasseur(c.id)}
                      className="flex min-h-20 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                    >
                      <KindBadge kind="classeur" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.nom}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {plural(classeurCount(c.id), "document")} · {formatDate(c.updatedAt)}
                        </span>
                      </span>
                    </button>
                  )}
                  {renaming?.id !== c.id && (
                    <div className="flex shrink-0 opacity-100 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 pointer-coarse:opacity-100">
                      <button
                        type="button"
                        className={btn.icon}
                        onClick={() => setRenaming({ id: c.id, value: c.nom })}
                        aria-label={`Renommer ${c.nom}`}
                        title="Renommer"
                      >
                        <PencilIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className={`${btn.icon} hover:text-red-600 dark:hover:text-red-400`}
                        onClick={() => setToDelete(c)}
                        aria-label={`Supprimer ${c.nom}`}
                        title="Supprimer"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Page>

      {toDelete && (
        <Modal
          title="Supprimer ce classeur ?"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setToDelete(null)}>
                Annuler
              </button>
              <button className={btn.danger} onClick={confirmDelete}>
                <TrashIcon size={16} /> Supprimer
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            « {toDelete.nom} » et tout ce qu'il contient ({plural(classeurCount(toDelete.id), "document")}) seront supprimés de cet appareil.
          </p>
        </Modal>
      )}
    </div>
  );
}
