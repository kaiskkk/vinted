import { useEffect, useMemo, useRef, useState } from "react";
import { DocList } from "../components/DocList";
import { CameraIcon, SparklesIcon, UploadIcon, XIcon } from "../components/Icons";
import { MODE_INFO } from "../components/looks";
import { MicButton } from "../components/MicButton";
import { useToast } from "../components/Toasts";
import { ClaudeTaskOverlay, EmptyState, NiveauPicker, Page, PageHeader, card, input, useClaudeTask, useNiveau } from "../components/ui";
import { goHome, openDoc } from "../hooks/useHashRoute";
import { analyserCopie } from "../lib/api";
import { copieFromIA, saveDoc } from "../lib/docs";
import { imageToJpegBase64 } from "../lib/importSource";
import { listLibrary } from "../lib/library";
import { recordActivity } from "../lib/serie";

const MAX_PAGES = 4;
const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

export default function CopiePage() {
  const info = MODE_INFO.copie;
  const toast = useToast();
  const task = useClaudeTask();
  const [niveau] = useNiveau();
  const [items, setItems] = useState(() => listLibrary().filter((i) => i.kind === "copie"));
  const [photos, setPhotos] = useState<File[]>([]);
  const [matiere, setMatiere] = useState("");
  const [consigne, setConsigne] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addPhotos = (files: FileList | null) => {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!images.length) return toast.error("Choisis des photos de ta copie (JPEG ou PNG).");
    setPhotos((cur) => {
      const next = [...cur, ...images].slice(0, MAX_PAGES);
      if (cur.length + images.length > MAX_PAGES) toast.info(`${MAX_PAGES} pages au maximum : les suivantes n'ont pas été ajoutées.`);
      return next;
    });
  };

  const analyse = () => {
    if (!photos.length) return toast.error("Ajoute d'abord une photo de ta copie corrigée.");
    void task.run("L'IA lit ta copie et ses corrections…", async (signal) => {
      // Photos réduites : l'envoi est rapide et la lecture reste nette.
      const images = await Promise.all(photos.map(async (f) => ({ media: "image/jpeg", data: await imageToJpegBase64(f, 1600) })));
      const ia = await analyserCopie(
        images,
        { ...(matiere.trim() ? { matiere: matiere.trim() } : {}), ...(consigne.trim() ? { consigne: consigne.trim() } : {}) },
        niveau,
        signal,
      );
      const doc = copieFromIA(ia);
      saveDoc(doc);
      recordActivity("copie");
      openDoc(doc.id);
    });
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
            Prends en photo ta copie corrigée : l'IA t'explique chaque erreur, te donne la correction et des exercices pour ne plus les refaire.
          </p>
        </section>

        <section className={`${card} mt-6 space-y-4 p-4 sm:p-5`} aria-labelledby="nouvelle-copie">
          <h2 id="nouvelle-copie" className="font-semibold">
            Nouvelle copie
          </h2>

          <div>
            <p className="text-sm font-semibold">
              Photos de la copie{" "}
              <span className="font-normal text-slate-500 dark:text-slate-400">
                ({photos.length}/{MAX_PAGES} pages)
              </span>
            </p>
            {photos.length > 0 && (
              <ul className="mt-2 grid grid-cols-4 gap-2">
                {previews.map((src, i) => (
                  <li key={src} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <img src={src} alt={`Page ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))}
                      className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white tap:h-11 tap:w-11"
                      aria-label={`Retirer la page ${i + 1}`}
                    >
                      <XIcon size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {photos.length < MAX_PAGES && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {isTouch() && (
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-yellow-400 bg-yellow-50/60 p-3 text-center transition active:scale-[0.99] dark:border-yellow-500/50 dark:bg-yellow-500/5"
                  >
                    <CameraIcon size={22} className="text-yellow-600" />
                    <span className="text-sm font-semibold">Prendre une photo</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-3 text-center transition hover:border-yellow-400 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <UploadIcon size={22} className="text-yellow-600" />
                  <span className="text-sm font-semibold">Choisir des photos</span>
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Une photo par page, bien à plat et nette, avec les annotations du professeur visibles. Les photos ne sont pas gardées : seule l'analyse
              est enregistrée.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Matière <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
              <input
                value={matiere}
                onChange={(e) => setMatiere(e.target.value.slice(0, 100))}
                placeholder="Ex. Maths, Français…"
                className={`${input} mt-2 h-12 font-normal`}
              />
            </label>
            <div>
              <label className="block text-sm font-semibold" htmlFor="consigne-copie">
                Une précision ? <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
              </label>
              <div className="mt-2 flex items-center gap-1">
                <input
                  id="consigne-copie"
                  value={consigne}
                  onChange={(e) => setConsigne(e.target.value.slice(0, 300))}
                  placeholder="Ex. surtout l'exercice 2"
                  className={`${input} h-12 font-normal`}
                />
                <MicButton value={consigne} max={300} onChange={setConsigne} label="Dicter ta précision" />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <NiveauPicker />
            <div className="hidden flex-1 sm:block" />
            <button
              type="button"
              onClick={analyse}
              disabled={task.busy}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 ${info.gradient} ${info.shadow}`}
            >
              <SparklesIcon size={18} /> Analyser ma copie
            </button>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="mes-copies">
          <h2 id="mes-copies" className="mb-3 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Mes copies {items.length > 0 && <span className="ml-1 text-slate-400 dark:text-slate-500">({items.length})</span>}
          </h2>
          {items.length === 0 ? (
            <EmptyState
              icon={<span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${info.soft}`}>{info.icon(24)}</span>}
              title="Aucune copie pour l'instant"
            >
              Tes copies analysées, avec leurs erreurs expliquées, apparaîtront ici.
            </EmptyState>
          ) : (
            <DocList items={items} onChange={() => setItems(listLibrary().filter((i) => i.kind === "copie"))} showType={false} />
          )}
        </section>
      </Page>
      <ClaudeTaskOverlay task={task} />
    </div>
  );
}
