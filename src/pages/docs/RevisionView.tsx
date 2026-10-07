import { useState } from "react";
import { SavedIndicator } from "../../components/CanvasOverlays";
import { CheckIcon, PencilIcon, PlusIcon, RedoIcon, TrashIcon, UndoIcon } from "../../components/Icons";
import { btn } from "../../components/Modal";
import { SimplifyButton } from "../../components/Simplify";
import { useToast } from "../../components/Toasts";
import { AutoTextarea, Page, PageHeader, RichText } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import type { RevisionDoc } from "../../lib/docs";
import { newId } from "../../lib/mapModel";
import { PrintButtons, printDate, useUndoShortcuts } from "./common";

const COLORS = ["#e11d48", "#d97706", "#059669", "#0284c7", "#7c3aed", "#ea580c", "#db2777", "#0891b2"];
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);

/** Fiche de révision express : l'essentiel sur une page, les 10 choses à savoir, les pièges. */
export function RevisionView({ initial, onBack }: { initial: RevisionDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update, undo, redo, canUndo, canRedo, savedAt } = useDoc(initial, toast.error);
  const [editing, setEditing] = useState(false);
  useUndoShortcuts(undo, redo);

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre}
        subtitle="Fiche de révision express"
        onBack={onBack}
        width="max-w-4xl"
        actions={<SavedIndicator at={savedAt} className="mr-1 hidden sm:inline-flex" />}
      />
      <div className="no-print mx-auto flex max-w-4xl gap-2 px-4 pt-4 sm:justify-end sm:px-6">
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

      <Page width="max-w-4xl" className="print-page">
        <article className="fiche print:text-[9pt]">
          <header className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b-2 border-rose-500 pb-3">
            {editing ? (
              <input
                value={doc.titre}
                onChange={(e) => update((d) => ({ ...d, titre: e.target.value.slice(0, 140) }), { key: "titre" })}
                aria-label="Titre"
                className="fiche-input fiche-title"
              />
            ) : (
              <h1 className="fiche-title w-auto! flex-1">{doc.titre}</h1>
            )}
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              Révision express
            </span>
          </header>

          {(doc.top10.length > 0 || editing) && (
            <section className="mt-5" aria-labelledby="top10">
              <h2 id="top10" className="flex items-center gap-2 text-lg font-extrabold">
                <span aria-hidden="true">🎯</span> Les {doc.top10.length || 10} choses à savoir absolument
              </h2>
              <ol className="mt-3 grid gap-2 md:grid-cols-2 print:grid-cols-2 print:gap-1.5">
                {doc.top10.map((t, i) => (
                  <li
                    key={t.id}
                    className="print-avoid flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40 print:p-1.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-rose-500 to-pink-500 text-sm font-bold text-white print:h-5 print:w-5 print:text-[8pt]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <>
                          <input
                            value={t.texte}
                            onChange={(e) =>
                              update((d) => ({ ...d, top10: d.top10.map((x) => (x.id === t.id ? { ...x, texte: e.target.value } : x)) }), {
                                key: `t-${t.id}`,
                              })
                            }
                            aria-label={`Point ${i + 1}`}
                            className="fiche-input font-semibold"
                          />
                          <input
                            value={t.detail}
                            onChange={(e) =>
                              update((d) => ({ ...d, top10: d.top10.map((x) => (x.id === t.id ? { ...x, detail: e.target.value } : x)) }), {
                                key: `d-${t.id}`,
                              })
                            }
                            placeholder="Détail (facultatif)"
                            aria-label={`Détail du point ${i + 1}`}
                            className="fiche-input text-sm"
                          />
                        </>
                      ) : (
                        <>
                          <RichText text={t.texte} className="leading-snug font-semibold" />
                          {t.detail && <RichText text={t.detail} className="mt-0.5 text-sm text-slate-600 dark:text-slate-300 print:text-[8.5pt]" />}
                        </>
                      )}
                    </div>
                    {editing ? (
                      <button
                        type="button"
                        className={`${btn.icon} no-print`}
                        onClick={() => update((d) => ({ ...d, top10: d.top10.filter((x) => x.id !== t.id) }))}
                        aria-label="Supprimer ce point"
                      >
                        <TrashIcon size={15} />
                      </button>
                    ) : (
                      <SimplifyButton
                        compact
                        text={[t.texte, t.detail].filter(Boolean).join(" — ")}
                        contexte={doc.titre}
                        className="-my-1 self-start"
                      />
                    )}
                  </li>
                ))}
              </ol>
              {editing && doc.top10.length < 10 && (
                <button
                  type="button"
                  className={`${btn.secondary} no-print mt-2 border-dashed`}
                  onClick={() => update((d) => ({ ...d, top10: [...d.top10, { id: newId(), texte: "", detail: "" }] }))}
                >
                  <PlusIcon size={15} /> Ajouter un point
                </button>
              )}
            </section>
          )}

          <section className="mt-6" aria-labelledby="essentiel">
            <h2 id="essentiel" className="flex items-center gap-2 text-lg font-extrabold">
              <span aria-hidden="true">📌</span> L'essentiel
            </h2>
            <div className="mt-3 gap-3 sm:columns-2 print:columns-2 print:gap-2">
              {doc.essentiel.map((s, i) => {
                const color = COLORS[i % COLORS.length];
                return (
                  <section
                    key={s.id}
                    className="print-avoid mb-3 break-inside-avoid rounded-xl border-t-4 bg-white p-3 shadow-sm dark:bg-slate-900/60 print:mb-2 print:p-2 print:shadow-none"
                    style={{ borderTopColor: color }}
                  >
                    {editing ? (
                      <>
                        <div className="flex items-center gap-1">
                          <input
                            value={s.titre}
                            onChange={(e) =>
                              update((d) => ({ ...d, essentiel: d.essentiel.map((x) => (x.id === s.id ? { ...x, titre: e.target.value } : x)) }), {
                                key: `st-${s.id}`,
                              })
                            }
                            aria-label="Titre de la rubrique"
                            className="fiche-input font-bold"
                            style={{ color }}
                          />
                          <button
                            type="button"
                            className={`${btn.icon} no-print`}
                            onClick={() => update((d) => ({ ...d, essentiel: d.essentiel.filter((x) => x.id !== s.id) }))}
                            aria-label="Supprimer la rubrique"
                          >
                            <TrashIcon size={15} />
                          </button>
                        </div>
                        <AutoTextarea
                          value={s.points.join("\n")}
                          onChange={(v) =>
                            update((d) => ({ ...d, essentiel: d.essentiel.map((x) => (x.id === s.id ? { ...x, points: v.split("\n") } : x)) }), {
                              key: `sp-${s.id}`,
                            })
                          }
                          aria-label="Points (un par ligne)"
                          placeholder="Un point par ligne"
                          className="fiche-input mt-1 text-sm leading-relaxed"
                        />
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-1">
                          <h3 className="flex-1 font-bold" style={{ color }}>
                            {s.titre}
                          </h3>
                          <SimplifyButton compact text={`${s.titre} : ${s.points.join(" ; ")}`} contexte={doc.titre} className="-my-1" />
                        </div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm leading-snug marker:text-slate-400 print:text-[8.5pt]">
                          {lines(s.points.join("\n")).map((p, k) => (
                            <li key={k}>
                              <RichText text={p} className="inline" />
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>
                );
              })}
            </div>
            {editing && (
              <button
                type="button"
                className={`${btn.secondary} no-print border-dashed`}
                onClick={() => update((d) => ({ ...d, essentiel: [...d.essentiel, { id: newId(), titre: "Nouvelle rubrique", points: [] }] }))}
              >
                <PlusIcon size={15} /> Ajouter une rubrique
              </button>
            )}
          </section>

          {(doc.pieges.length > 0 || editing) && (
            <section className="print-avoid mt-5 rounded-xl border border-red-200 bg-red-50/70 p-3 dark:border-red-500/25 dark:bg-red-500/10 print:p-2">
              <h2 className="font-extrabold text-red-700 dark:text-red-300">⚠️ Pièges à éviter</h2>
              {editing ? (
                <AutoTextarea
                  value={doc.pieges.join("\n")}
                  onChange={(v) => update((d) => ({ ...d, pieges: v.split("\n") }), { key: "pieges" })}
                  placeholder="Un piège par ligne"
                  aria-label="Pièges (un par ligne)"
                  className="fiche-input mt-1 text-sm"
                />
              ) : (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm print:text-[8.5pt]">
                  {doc.pieges.map((p, i) => (
                    <li key={i}>
                      <RichText text={p} className="inline" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <footer className="fiche-foot">Révision ecoleduc · {printDate(doc.updatedAt)}</footer>
        </article>
      </Page>
    </div>
  );
}
