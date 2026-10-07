import { useRef, useState } from "react";
import { SOURCE_MAX } from "../../shared/study";
import { ACCEPTED_FILES, extractText } from "../lib/importSource";
import { CameraIcon, FileTextIcon, Spinner, UploadIcon, XIcon } from "./Icons";
import { btn } from "./Modal";
import { AutoTextarea, Segmented, input } from "./ui";

export interface SourceValue {
  cours: string;
  sujet: string;
  fichiers: string[];
}
export const emptySource = (): SourceValue => ({ cours: "", sujet: "", fichiers: [] });
export const hasSource = (s: SourceValue) => Boolean(s.cours.trim() || s.sujet.trim());

type Tab = "coller" | "sujet" | "importer";
const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Ajout de matière : coller un cours, écrire un sujet, ou importer un PDF, un texte ou des photos.
 * Le texte importé reste modifiable avant de lancer Claude.
 */
export function SourcePicker({
  value,
  onChange,
  onError,
}: {
  value: SourceValue;
  onChange: (v: SourceValue) => void;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(value.sujet && !value.cours ? "sujet" : "coller");
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    const c = new AbortController();
    controller.current = c;
    try {
      for (const file of files) {
        const text = await extractText(file, setProgress, c.signal);
        if (!text.trim()) throw new Error(`Aucun texte trouvé dans « ${file.name} ».`);
        const cur = latest.current;
        onChange({
          ...cur,
          cours: cur.cours.trim() ? `${cur.cours.trim()}\n\n${text}` : text,
          fichiers: [...cur.fichiers, file.name],
        });
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        onError(err instanceof Error ? err.message : "Import impossible.");
      }
    } finally {
      controller.current = null;
      setProgress(null);
    }
  };

  const length = value.cours.length;
  const textarea = (
    <div>
      <AutoTextarea
        value={value.cours}
        onChange={(cours) => onChange({ ...value, cours })}
        minRows={tab === "coller" ? 8 : 5}
        placeholder={tab === "coller" ? "Colle ici ton cours, tes notes, un chapitre de manuel…" : "Le texte importé apparaîtra ici."}
        aria-label="Texte du cours"
        className={`${input} max-h-[50dvh] min-h-40 overflow-y-auto py-3 leading-relaxed`}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{value.fichiers.length > 0 && `Importé : ${value.fichiers.join(", ")}`}</span>
        <span className={length > SOURCE_MAX ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
          {length > SOURCE_MAX
            ? `Trop long : seuls les ${SOURCE_MAX.toLocaleString("fr-FR")} premiers caractères seront utilisés`
            : `${length.toLocaleString("fr-FR")} caractère${length > 1 ? "s" : ""}`}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <Segmented<Tab>
        label="Type de contenu"
        value={tab}
        onChange={setTab}
        options={[
          { value: "coller", label: "Coller mon cours" },
          { value: "sujet", label: "Un sujet" },
          { value: "importer", label: "Importer" },
        ]}
      />

      {tab === "coller" && textarea}

      {tab === "sujet" && (
        <div>
          <input
            value={value.sujet}
            onChange={(e) => onChange({ ...value, sujet: e.target.value.slice(0, 300) })}
            placeholder="Ex. La photosynthèse, Le théorème de Pythagore…"
            aria-label="Sujet"
            enterKeyHint="done"
            className={`${input} h-12`}
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Pas de cours sous la main ? Claude s'appuie sur ce qu'on apprend à ton niveau.
            {value.cours.trim() && " Ton cours collé reste prioritaire."}
          </p>
        </div>
      )}

      {tab === "importer" && (
        <div className="space-y-3">
          {progress ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-4 text-center text-sm text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
              <span className="flex items-center gap-2" aria-live="polite">
                <Spinner /> {progress}
              </span>
              <button type="button" className={btn.secondary} onClick={() => controller.current?.abort()}>
                <XIcon size={15} /> Arrêter
              </button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-4 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/5"
              >
                <UploadIcon size={22} className="text-indigo-500" />
                <span className="text-sm font-semibold">Choisir un fichier</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">PDF, texte (.txt, .md) ou photo</span>
              </button>
              {isTouch() ? (
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-4 text-center transition hover:border-indigo-400 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <CameraIcon size={22} className="text-indigo-500" />
                  <span className="text-sm font-semibold">Prendre en photo</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Une page de cahier ou de manuel</span>
                </button>
              ) : (
                <div className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl bg-slate-100/70 p-4 text-center text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <FileTextIcon size={20} />
                  Les PDF avec du texte sont lus directement sur ton appareil. Les photos et les PDF scannés sont lus par Claude.
                </div>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void importFiles(files);
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void importFiles(files);
            }}
          />
          {(value.cours || value.fichiers.length > 0) && textarea}
        </div>
      )}
    </div>
  );
}
