import { useState } from "react";
import { SavedIndicator } from "../../components/CanvasOverlays";
import { CheckIcon, PencilIcon, PlusIcon, RedoIcon, TrashIcon, UndoIcon } from "../../components/Icons";
import { btn } from "../../components/Modal";
import { SimplifyButton } from "../../components/Simplify";
import { useToast } from "../../components/Toasts";
import { AutoTextarea, Page, PageHeader, RichText } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import type { ResumeDoc } from "../../lib/docs";
import { newId } from "../../lib/mapModel";
import { PrintButtons, printDate, useUndoShortcuts } from "./common";

export function ResumeView({ initial, onBack }: { initial: ResumeDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, undo, redo, canUndo, canRedo, savedAt } = useDoc(initial, toast.error);
  const [editing, setEditing] = useState(false);
  useUndoShortcuts(undo, redo);

  const field = (value: string, onChange: (v: string) => void, label: string, key: string, className = "") =>
    editing ? (
      <AutoTextarea
        value={value}
        onChange={onChange}
        aria-label={label}
        placeholder={label}
        className={`fiche-input leading-relaxed ${className}`}
        key={key}
      />
    ) : (
      value && <RichText text={value} className={`leading-relaxed ${className}`} />
    );

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre}
        subtitle="Résumé du cours"
        onBack={onBack}
        width="max-w-3xl"
        actions={<SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />}
      />
      <div className="no-print mx-auto flex max-w-3xl gap-2 px-4 pt-4 sm:justify-end sm:px-6">
        {editing && (
          <>
            <button
              type="button"
              className={`${btn.icon} border border-slate-200 dark:border-slate-700`}
              onClick={undo}
              disabled={!canUndo}
              aria-label="Annuler"
              title="Annuler (Ctrl + Z)"
            >
              <UndoIcon size={17} />
            </button>
            <button
              type="button"
              className={`${btn.icon} border border-slate-200 dark:border-slate-700`}
              onClick={redo}
              disabled={!canRedo}
              aria-label="Rétablir"
              title="Rétablir (Ctrl + Y)"
            >
              <RedoIcon size={17} />
            </button>
          </>
        )}
        <button type="button" onClick={() => setEditing((e) => !e)} className={`${editing ? btn.primary : btn.secondary} flex-1 sm:flex-none`}>
          {editing ? <CheckIcon size={17} /> : <PencilIcon size={16} />}
          {editing ? "Terminé" : "Modifier"}
        </button>
        {!editing && <PrintButtons />}
      </div>
      <Page width="max-w-3xl" className="print-page">
        <article className="fiche fiche-minimaliste">
          <header className="fiche-head">
            {editing ? (
              <input
                value={doc.titre}
                onChange={(e) => update((d) => ({ ...d, titre: e.target.value.slice(0, 140) }), { key: "titre" })}
                aria-label="Titre"
                className="fiche-input fiche-title text-center"
              />
            ) : (
              <h1 className="fiche-title">{doc.titre}</h1>
            )}
            <p className="fiche-subtitle">Résumé</p>
          </header>
          <div className="space-y-5 border-t border-[var(--line)] pt-5">
            {(doc.introduction || editing) && (
              <div className="text-[1.05rem] italic">
                {field(doc.introduction, (v) => update((d) => ({ ...d, introduction: v }), { key: "intro" }), "Introduction", "intro")}
              </div>
            )}
            {doc.sections.map((s, i) => (
              <section key={s.id} className="print-avoid">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 font-sans text-sm font-bold text-blue-600 tabular-nums dark:text-blue-300">{i + 1}.</span>
                  {editing ? (
                    <input
                      value={s.titre}
                      onChange={(e) =>
                        update((d) => ({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, titre: e.target.value } : x)) }), {
                          key: `t-${s.id}`,
                        })
                      }
                      aria-label="Titre de la partie"
                      className="fiche-input flex-1 text-lg font-bold"
                    />
                  ) : (
                    <h2 className="flex-1 text-lg font-bold">{s.titre}</h2>
                  )}
                  {editing ? (
                    <button
                      type="button"
                      className={`${btn.icon} no-print`}
                      onClick={() => update((d) => ({ ...d, sections: d.sections.filter((x) => x.id !== s.id) }))}
                      aria-label="Supprimer la partie"
                    >
                      <TrashIcon size={15} />
                    </button>
                  ) : (
                    <SimplifyButton compact text={`${s.titre}\n${s.texte}`} contexte={doc.titre} className="-my-1" />
                  )}
                </div>
                <div className="mt-1">
                  {field(
                    s.texte,
                    (v) => update((d) => ({ ...d, sections: d.sections.map((x) => (x.id === s.id ? { ...x, texte: v } : x)) }), { key: `x-${s.id}` }),
                    "Texte de la partie",
                    `x-${s.id}`,
                  )}
                </div>
              </section>
            ))}
            {editing && (
              <button
                type="button"
                className={`${btn.secondary} no-print border-dashed font-sans`}
                onClick={() => update((d) => ({ ...d, sections: [...d.sections, { id: newId(), titre: "Nouvelle partie", texte: "" }] }))}
              >
                <PlusIcon size={15} /> Ajouter une partie
              </button>
            )}
            {(doc.conclusion || editing) && (
              <div className="print-avoid rounded-xl bg-blue-50 p-4 dark:bg-blue-500/10">
                <p className="mb-1 font-sans text-xs font-bold tracking-wider text-blue-700 uppercase dark:text-blue-300">En résumé</p>
                {field(doc.conclusion, (v) => update((d) => ({ ...d, conclusion: v }), { key: "conclusion" }), "Conclusion", "conclusion")}
              </div>
            )}
          </div>
          <footer className="fiche-foot font-sans">Résumé ecoleduc · {printDate(doc.updatedAt)}</footer>
        </article>
      </Page>
    </div>
  );
}
