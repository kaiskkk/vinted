import { useMemo, useRef, useState } from "react";
import { SOURCE_MAX, TYPES_DEVOIR, type TypeDevoir } from "../../shared/study";
import { DocList } from "../components/DocList";
import { ChevronRightIcon, Spinner, UploadIcon } from "../components/Icons";
import { MODE_INFO } from "../components/looks";
import { MicButton } from "../components/MicButton";
import { btn } from "../components/Modal";
import { useToast } from "../components/Toasts";
import { AutoTextarea, EmptyState, Page, PageHeader, Segmented, card, input } from "../components/ui";
import { goHome, openDoc } from "../hooks/useHashRoute";
import { listClasseurs, newRedaction, saveDoc, touchClasseur } from "../lib/docs";
import { ACCEPTED_FILES, extractText } from "../lib/importSource";
import { listLibrary } from "../lib/library";

const PLACEHOLDERS: Record<TypeDevoir, string> = {
  dissertation: "Ex. Le bonheur dépend-il de nous ?",
  commentaire: "Ex. Commentez cet extrait de Candide (chapitre 3)",
  expose: "Ex. Les énergies renouvelables en France",
  redaction: "Ex. Racontez un souvenir d'enfance qui vous a marqué",
};

export default function RedactionPage() {
  const info = MODE_INFO.redaction;
  const toast = useToast();
  const classeurs = useMemo(listClasseurs, []);
  const [items, setItems] = useState(() => listLibrary().filter((i) => i.kind === "redaction"));
  const [typeDevoir, setTypeDevoir] = useState<TypeDevoir>("dissertation");
  const [sujet, setSujet] = useState("");
  const [matiere, setMatiere] = useState("");
  const [document, setDocument] = useState("");
  const [classeurId, setClasseurId] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => setItems(listLibrary().filter((i) => i.kind === "redaction"));
  const description = TYPES_DEVOIR.find((t) => t.value === typeDevoir)?.description;

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await extractText(file, setImporting);
      if (!text.trim()) throw new Error(`Aucun texte trouvé dans « ${file.name} ».`);
      setDocument((d) => (d.trim() ? `${d.trim()}\n\n${text}` : text).slice(0, SOURCE_MAX));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setImporting(null);
    }
  };

  const create = () => {
    if (!sujet.trim()) return toast.error("Écris d'abord le sujet de ton devoir.");
    if (typeDevoir === "commentaire" && !document.trim()) return toast.error("Ajoute le texte ou le document à commenter.");
    try {
      const doc = newRedaction(
        { typeDevoir, sujet: sujet.trim(), matiere: matiere.trim(), document: typeDevoir === "commentaire" ? document.trim() : "" },
        classeurId || undefined,
      );
      saveDoc(doc);
      touchClasseur(classeurId || undefined);
      openDoc(doc.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    }
  };

  return (
    <div className="min-h-dvh">
      <PageHeader title={info.label} onBack={goHome} backLabel="Retour à l'accueil" />
      <Page>
        <section className="flex items-center gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 animate-pop items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg ${info.gradient} ${info.shadow}`}
          >
            {info.icon(28)}
          </span>
          <p className="text-balance text-slate-600 dark:text-slate-300">
            L'IA te propose une problématique et un plan détaillé, puis relit ton texte pour te conseiller. Elle ne rédige pas ton devoir à ta place.
          </p>
        </section>

        <section className={`${card} mt-6 space-y-4 p-4 sm:p-5`} aria-labelledby="nouveau-devoir">
          <h2 id="nouveau-devoir" className="font-semibold">
            Nouveau devoir
          </h2>
          <div>
            <Segmented
              label="Type de devoir"
              value={typeDevoir}
              onChange={setTypeDevoir}
              options={TYPES_DEVOIR.map((t) => ({ value: t.value, label: t.label }))}
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="sujet">
              Le sujet
            </label>
            <div className="mt-2 flex items-start gap-1">
              <AutoTextarea
                id="sujet"
                value={sujet}
                onChange={(v) => setSujet(v.slice(0, 3000))}
                minRows={2}
                placeholder={PLACEHOLDERS[typeDevoir]}
                className={`${input} py-3`}
              />
              <MicButton value={sujet} onChange={setSujet} max={3000} label="Dicter le sujet" />
            </div>
          </div>
          {typeDevoir === "commentaire" && (
            <div>
              <div className="flex items-center gap-2">
                <label className="flex-1 text-sm font-semibold" htmlFor="document">
                  Le texte à commenter
                </label>
                <button
                  type="button"
                  className={`${btn.secondary} min-h-9 px-3`}
                  onClick={() => fileRef.current?.click()}
                  disabled={importing !== null}
                >
                  {importing !== null ? <Spinner className="h-4 w-4" /> : <UploadIcon size={15} />} PDF ou photo
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_FILES}
                  className="hidden"
                  onChange={(e) => {
                    void importFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              {importing && <p className="mt-1 text-xs text-slate-500">{importing}</p>}
              <AutoTextarea
                id="document"
                value={document}
                onChange={(v) => setDocument(v.slice(0, SOURCE_MAX))}
                minRows={5}
                placeholder="Colle ici le texte, le poème ou la description du document."
                className={`${input} mt-2 max-h-[45dvh] overflow-y-auto py-3 text-sm leading-relaxed`}
              />
            </div>
          )}
          <div className={`grid gap-4 ${classeurs.length ? "sm:grid-cols-2" : ""}`}>
            <label className="block text-sm font-semibold">
              Matière <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
              <input
                value={matiere}
                onChange={(e) => setMatiere(e.target.value.slice(0, 100))}
                placeholder="Ex. Philosophie, Français, Histoire…"
                className={`${input} mt-2 h-12 font-normal`}
              />
            </label>
            {classeurs.length > 0 && (
              <label className="block text-sm font-semibold">
                Ranger dans <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
                <select value={classeurId} onChange={(e) => setClasseurId(e.target.value)} className={`${input} mt-2 h-12 font-normal`}>
                  <option value="">Aucun classeur</option>
                  {classeurs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button
            type="button"
            onClick={create}
            className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] sm:w-auto ${info.gradient} ${info.shadow}`}
          >
            Commencer <ChevronRightIcon size={18} />
          </button>
        </section>

        <section className="mt-10" aria-labelledby="mes-devoirs">
          <h2 id="mes-devoirs" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Mes devoirs {items.length > 0 && <span className="ml-1 text-slate-400 dark:text-slate-500">({items.length})</span>}
          </h2>
          {items.length === 0 ? (
            <EmptyState
              icon={<span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${info.soft}`}>{info.icon(24)}</span>}
              title="Aucun devoir pour l'instant"
            >
              Tes devoirs, leurs plans et leurs relectures apparaîtront ici.
            </EmptyState>
          ) : (
            <DocList items={items} onChange={refresh} showType={false} />
          )}
        </section>
      </Page>
    </div>
  );
}
