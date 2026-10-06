import { useRef, useState } from "react";
import { BrainIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { Modal, btn } from "../components/Modal";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toasts";
import { openMap } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import { parseImport, readFile } from "../lib/exporters";
import { DEFAULT_EDGE, newId } from "../lib/mapModel";
import { createMap, deleteMap, listMaps, renameMap, saveMap } from "../lib/storage";
import type { MapSummary } from "../types";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function formatDate(ts: number) {
  const diff = (ts - Date.now()) / 1000;
  if (diff > -60) return "à l'instant";
  if (diff > -3600) return relative.format(Math.round(diff / 60), "minute");
  if (diff > -86400) return relative.format(Math.round(diff / 3600), "hour");
  return `le ${dateFormat.format(ts)}`;
}

export default function Home() {
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [maps, setMaps] = useState<MapSummary[]>(listMaps);
  const [newName, setNewName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [toDelete, setToDelete] = useState<MapSummary | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = () => setMaps(listMaps());

  const create = () => {
    const name = newName?.trim() || "Nouvelle carte mentale";
    try {
      const map = createMap(name);
      openMap(map.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    }
  };

  const commitRename = () => {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (value) renameMap(renaming.id, value);
    setRenaming(null);
    refresh();
  };

  const importFile = async (file: File) => {
    try {
      const content = parseImport(await readFile(file), DEFAULT_EDGE);
      const now = Date.now();
      const id = newId();
      saveMap({ id, createdAt: now, updatedAt: now, ...content });
      toast.success(`« ${content.name} » importée.`);
      openMap(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    }
  };

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* Halo décoratif */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-linear-to-br from-indigo-500/25 via-violet-500/15 to-fuchsia-500/20 blur-3xl dark:from-indigo-500/20 dark:via-violet-600/10 dark:to-fuchsia-600/15"
        aria-hidden="true"
      />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle theme={theme} onToggle={toggle} />
      </div>

      <main className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-24 pb-16">
        <div className="mb-6 flex h-16 w-16 animate-pop items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/30">
          <BrainIcon size={34} />
        </div>
        <h1 className="animate-slide-up text-center text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">Cartes mentales</span>
        </h1>
        <p className="mt-4 max-w-md animate-slide-up text-center text-slate-500 dark:text-slate-400">
          Organise tes idées visuellement, à la main ou avec l'aide de Claude.
        </p>

        <button
          type="button"
          onClick={() => setNewName("")}
          className="group mt-10 inline-flex animate-slide-up items-center gap-3 rounded-2xl bg-linear-to-r from-indigo-600 to-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-600/40 active:translate-y-0"
        >
          <PlusIcon size={22} strokeWidth={2.5} className="transition group-hover:rotate-90" />
          Nouvelle carte mentale
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
        >
          <UploadIcon size={15} /> Importer un fichier JSON
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />

        <section className="mt-16 w-full">
          <h2 className="mb-4 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Mes cartes {maps.length > 0 && <span className="ml-1 text-slate-400 dark:text-slate-500">({maps.length})</span>}
          </h2>

          {maps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Aucune carte pour l'instant. Crée ta première carte mentale !
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {maps.map((m, i) => (
                <li
                  key={m.id}
                  className="group relative animate-slide-up rounded-2xl border border-slate-200 bg-white/80 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-indigo-500/50"
                  style={{ animationDelay: `${Math.min(i, 10) * 30}ms`, animationFillMode: "backwards" }}
                >
                  {renaming?.id === m.id ? (
                    <div className="p-4">
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={(e) => setRenaming({ id: m.id, value: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        aria-label="Nouveau nom"
                        className="w-full rounded-lg border border-indigo-400 bg-transparent px-2 py-1 font-semibold outline-none"
                      />
                      <p className="mt-2 text-xs text-slate-500">Entrée pour valider, Échap pour annuler</p>
                    </div>
                  ) : (
                    <button type="button" onClick={() => openMap(m.id)} className="block w-full p-4 pr-20 text-left">
                      <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{m.name}</span>
                      <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                        Modifiée {formatDate(m.updatedAt)} · {m.nodeCount} idée{m.nodeCount > 1 ? "s" : ""}
                      </span>
                    </button>
                  )}
                  {renaming?.id !== m.id && (
                    <div className="absolute top-3 right-3 flex gap-0.5 opacity-60 transition group-hover:opacity-100">
                      <button
                        type="button"
                        className={`${btn.icon} h-8 w-8`}
                        title="Renommer"
                        aria-label={`Renommer ${m.name}`}
                        onClick={() => setRenaming({ id: m.id, value: m.name })}
                      >
                        <PencilIcon size={15} />
                      </button>
                      <button
                        type="button"
                        className={`${btn.icon} h-8 w-8 hover:text-red-600 dark:hover:text-red-400`}
                        title="Supprimer"
                        aria-label={`Supprimer ${m.name}`}
                        onClick={() => setToDelete(m)}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {newName !== null && (
        <Modal
          title="Nouvelle carte mentale"
          onClose={() => setNewName(null)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setNewName(null)}>
                Annuler
              </button>
              <button className={btn.primary} onClick={create}>
                Créer
              </button>
            </>
          }
        >
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Nom de la carte (ce sera le nœud central)
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Nouvelle carte mentale"
              maxLength={120}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-base text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:text-white"
            />
          </label>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="Supprimer cette carte ?"
          onClose={() => setToDelete(null)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setToDelete(null)}>
                Annuler
              </button>
              <button
                className={btn.danger}
                onClick={() => {
                  deleteMap(toDelete.id);
                  setToDelete(null);
                  refresh();
                  toast.success("Carte supprimée.");
                }}
              >
                Supprimer
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            « {toDelete.name} » sera définitivement supprimée de ce navigateur. Pense à l'exporter en JSON si tu veux la garder.
          </p>
        </Modal>
      )}
    </div>
  );
}
