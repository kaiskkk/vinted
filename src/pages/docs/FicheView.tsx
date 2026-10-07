import { useState, type CSSProperties } from "react";
import { BLOC_TYPES, type BlocType } from "../../../shared/study";
import { SavedIndicator } from "../../components/CanvasOverlays";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PencilIcon, PlusIcon, RedoIcon, TrashIcon, UndoIcon, XIcon } from "../../components/Icons";
import { btn } from "../../components/Modal";
import { SimplifyButton } from "../../components/Simplify";
import { useToast } from "../../components/Toasts";
import { AutoTextarea, Page, PageHeader, RichText, Segmented } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import { BLOC_COLORS, BLOC_META, STYLE_LABELS } from "../../lib/blocs";
import { FICHE_STYLES, type FicheBloc, type FicheDoc, type FicheStyle } from "../../lib/docs";
import { newId } from "../../lib/mapModel";
import { PrintButtons, printDate, useUndoShortcuts } from "./common";

const colorOf = (b: FicheBloc) => b.couleur ?? BLOC_META[b.type].color;

export function FicheView({ initial, onBack }: { initial: FicheDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, undo, redo, canUndo, canRedo, savedAt } = useDoc(initial, toast.error);
  const [editing, setEditing] = useState(() => initial.blocs.every((b) => !b.contenu.trim() || b.contenu.trim() === "-"));
  const [palette, setPalette] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  useUndoShortcuts(undo, redo);

  const setBloc = (id: string, patch: Partial<FicheBloc>, key?: string) =>
    update((d) => ({ ...d, blocs: d.blocs.map((b) => (b.id === id ? { ...b, ...patch } : b)) }), { key });

  const move = (index: number, delta: number) =>
    update((d) => {
      const blocs = [...d.blocs];
      const target = index + delta;
      if (target < 0 || target >= blocs.length) return d;
      [blocs[index], blocs[target]] = [blocs[target], blocs[index]];
      return { ...d, blocs };
    });

  const remove = (bloc: FicheBloc) => {
    update((d) => ({ ...d, blocs: d.blocs.filter((b) => b.id !== bloc.id) }));
    toast.success(`Bloc « ${bloc.titre || BLOC_META[bloc.type].label} » supprimé.`, { label: "Annuler", onClick: undo });
  };

  const add = (type: BlocType) => {
    const id = newId();
    update((d) => ({
      ...d,
      blocs: [...d.blocs, { id, type, titre: type === "retenir" ? "À retenir" : "", contenu: type === "retenir" ? "- " : "" }],
    }));
    setAdding(false);
    // Le nouveau bloc reçoit le focus une fois affiché.
    requestAnimationFrame(() => document.getElementById(`titre-${id}`)?.focus());
  };

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre || "Fiche sans titre"}
        subtitle={doc.sousTitre || "Fiche de cours"}
        onBack={onBack}
        width="max-w-4xl"
        actions={<SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />}
      />

      <div className="no-print mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
        <Segmented<FicheStyle>
          label="Style de la fiche"
          value={doc.style}
          onChange={(style) => update((d) => ({ ...d, style }))}
          options={FICHE_STYLES.map((s) => ({ value: s, label: STYLE_LABELS[s] }))}
          className="w-full sm:w-auto"
          oneLine
        />
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          {editing && (
            <>
              <button
                type="button"
                className={`${btn.icon} border border-slate-200 dark:border-slate-700`}
                onClick={undo}
                disabled={!canUndo}
                title="Annuler (Ctrl + Z)"
                aria-label="Annuler"
              >
                <UndoIcon size={17} />
              </button>
              <button
                type="button"
                className={`${btn.icon} border border-slate-200 dark:border-slate-700`}
                onClick={redo}
                disabled={!canRedo}
                title="Rétablir (Ctrl + Y)"
                aria-label="Rétablir"
              >
                <RedoIcon size={17} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing((e) => !e);
              setPalette(null);
              setAdding(false);
            }}
            className={`${editing ? btn.primary : btn.secondary} flex-1 sm:flex-none`}
          >
            {editing ? <CheckIcon size={17} /> : <PencilIcon size={16} />}
            {editing ? "Terminé" : "Modifier"}
          </button>
          {!editing && <PrintButtons />}
        </div>
      </div>

      <Page width="max-w-4xl" className="print-page">
        <article className={`fiche fiche-${doc.style} ${editing ? "fiche-editing" : ""}`}>
          <header className="fiche-head">
            {editing ? (
              <>
                <input
                  value={doc.titre}
                  onChange={(e) => update((d) => ({ ...d, titre: e.target.value.slice(0, 140) }), { key: "titre" })}
                  placeholder="Titre de la fiche"
                  aria-label="Titre de la fiche"
                  className="fiche-input fiche-title"
                />
                <input
                  value={doc.sousTitre}
                  onChange={(e) => update((d) => ({ ...d, sousTitre: e.target.value.slice(0, 200) }), { key: "sousTitre" })}
                  placeholder="Matière — chapitre"
                  aria-label="Sous-titre"
                  className="fiche-input fiche-subtitle"
                />
              </>
            ) : (
              <>
                <h1 className="fiche-title">{doc.titre}</h1>
                {doc.sousTitre && <p className="fiche-subtitle">{doc.sousTitre}</p>}
              </>
            )}
          </header>

          {!editing && <Legend blocs={doc.blocs} />}

          <div className="fiche-blocs">
            {doc.blocs.map((b, i) => {
              const meta = BLOC_META[b.type];
              const style = { "--c": colorOf(b) } as CSSProperties;
              if (!editing) {
                return (
                  <section key={b.id} className="fiche-bloc" data-type={b.type} style={style}>
                    <div className="fiche-bloc-top">
                      <span className="fiche-label">
                        <span aria-hidden="true">{meta.emoji}</span> {meta.label}
                      </span>
                      <SimplifyButton
                        compact
                        text={[b.titre, b.contenu].filter(Boolean).join(" : ")}
                        contexte={doc.titre}
                        className="-my-1 ml-auto"
                      />
                    </div>
                    {b.titre && b.titre.trim().toLowerCase() !== meta.label.toLowerCase() && <h3 className="fiche-bloc-titre">{b.titre}</h3>}
                    {b.contenu.trim() && <RichText text={b.contenu} className="fiche-bloc-contenu" />}
                  </section>
                );
              }
              return (
                <section key={b.id} className="fiche-bloc" data-type={b.type} style={style}>
                  <div className="fiche-tools no-print">
                    <label className="fiche-type">
                      <span className="sr-only">Type du bloc</span>
                      <span aria-hidden="true">{meta.emoji}</span>
                      <select value={b.type} onChange={(e) => setBloc(b.id, { type: e.target.value as BlocType })} aria-label="Type du bloc">
                        {BLOC_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {BLOC_META[t].label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="fiche-swatch"
                      onClick={() => setPalette(palette === b.id ? null : b.id)}
                      aria-label="Couleur du bloc"
                      aria-expanded={palette === b.id}
                      title="Couleur du bloc"
                    >
                      <span style={{ background: colorOf(b) }} />
                    </button>
                    <div className="ml-auto flex">
                      <button
                        type="button"
                        className={btn.icon}
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Monter le bloc"
                        title="Monter"
                      >
                        <ArrowUpIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className={btn.icon}
                        onClick={() => move(i, 1)}
                        disabled={i === doc.blocs.length - 1}
                        aria-label="Descendre le bloc"
                        title="Descendre"
                      >
                        <ArrowDownIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className={`${btn.icon} hover:text-red-600 dark:hover:text-red-400`}
                        onClick={() => remove(b)}
                        aria-label="Supprimer le bloc"
                        title="Supprimer"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
                  {palette === b.id && (
                    <div className="no-print mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Couleurs">
                      <button
                        type="button"
                        onClick={() => {
                          setBloc(b.id, { couleur: undefined });
                          setPalette(null);
                        }}
                        className={`fiche-color-auto ${!b.couleur ? "is-active" : ""}`}
                      >
                        Auto
                      </button>
                      {BLOC_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setBloc(b.id, { couleur: c });
                            setPalette(null);
                          }}
                          className={`fiche-color ${b.couleur === c ? "is-active" : ""}`}
                          style={{ background: c }}
                          aria-label={`Couleur ${c}`}
                        />
                      ))}
                    </div>
                  )}
                  <input
                    id={`titre-${b.id}`}
                    value={b.titre}
                    onChange={(e) => setBloc(b.id, { titre: e.target.value.slice(0, 200) }, `titre-${b.id}`)}
                    placeholder={b.type === "date" ? "La date (ex. 14 juillet 1789)" : b.type === "definition" ? "Le mot à définir" : "Titre du bloc"}
                    aria-label="Titre du bloc"
                    className="fiche-input fiche-bloc-titre"
                  />
                  <AutoTextarea
                    value={b.contenu}
                    onChange={(v) => setBloc(b.id, { contenu: v.slice(0, 5000) }, `contenu-${b.id}`)}
                    minRows={2}
                    placeholder="Contenu… « - » en début de ligne pour une liste, **gras**, ==surligné=="
                    aria-label="Contenu du bloc"
                    className="fiche-input fiche-bloc-contenu"
                  />
                </section>
              );
            })}
          </div>

          {editing && (
            <div className="no-print mt-4">
              {adding ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">Quel type de bloc ?</p>
                    <button type="button" className={btn.icon} onClick={() => setAdding(false)} aria-label="Fermer">
                      <XIcon size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {BLOC_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => add(t)}
                        className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition active:scale-[0.98]"
                        style={{ borderColor: `${BLOC_META[t].color}55`, color: BLOC_META[t].color }}
                      >
                        <span aria-hidden="true">{BLOC_META[t].emoji}</span>
                        {BLOC_META[t].label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className={`${btn.secondary} w-full border-dashed`}>
                  <PlusIcon size={16} strokeWidth={2.5} /> Ajouter un bloc
                </button>
              )}
            </div>
          )}

          <footer className="fiche-foot">Fiche ecoleduc · {printDate(doc.updatedAt)}</footer>
        </article>
      </Page>
    </div>
  );
}

/** Légende du code couleur (types présents dans la fiche). */
function Legend({ blocs }: { blocs: FicheBloc[] }) {
  const types = BLOC_TYPES.filter((t) => t !== "texte" && blocs.some((b) => b.type === t));
  if (types.length < 2) return null;
  return (
    <ul className="fiche-legend" aria-label="Code couleur">
      {types.map((t) => (
        <li key={t} style={{ "--c": BLOC_META[t].color } as CSSProperties}>
          {BLOC_META[t].label}
        </li>
      ))}
    </ul>
  );
}
