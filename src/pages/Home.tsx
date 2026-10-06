import { useMemo, useRef, useState } from "react";
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon, UploadIcon, XIcon } from "../components/Icons";
import { InstallApp } from "../components/InstallApp";
import { Modal, btn } from "../components/Modal";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toasts";
import { openMap } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import { DEFAULT_EDGE, newId } from "../lib/mapModel";
import { createMap, deleteMap, listMaps, loadMap, renameMap, saveMap } from "../lib/storage";
import type { MapPreview, MapSummary } from "../types";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
const SORT_KEY = "mm-tri";

type SortMode = "recent" | "old" | "created" | "name";
const SORTS: { value: SortMode; label: string }[] = [
  { value: "recent", label: "Plus récentes" },
  { value: "old", label: "Plus anciennes" },
  { value: "created", label: "Dernières créées" },
  { value: "name", label: "Nom A → Z" },
];

function formatDate(ts: number) {
  const diff = (ts - Date.now()) / 1000;
  if (diff > -60) return "à l'instant";
  if (diff > -3600) return relative.format(Math.round(diff / 60), "minute");
  if (diff > -86400) return relative.format(Math.round(diff / 3600), "hour");
  if (diff > -7 * 86400) return relative.format(Math.round(diff / 86400), "day");
  return `le ${dateFormat.format(ts)}`;
}

/** Recherche insensible aux accents et à la casse. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function readSort(): SortMode {
  try {
    const v = localStorage.getItem(SORT_KEY) as SortMode | null;
    return v && SORTS.some((s) => s.value === v) ? v : "recent";
  } catch {
    return "recent";
  }
}

/** Aperçu miniature d'une carte (rectangles colorés et liens). */
function MapThumbnail({ preview }: { preview?: MapPreview }) {
  if (!preview) {
    return <div className="h-full w-full" aria-hidden="true" />;
  }
  const pad = 14;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${preview.w + pad * 2} ${preview.h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      {preview.e.map(([x1, y1, x2, y2, c], i) => (
        <line key={`e${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeOpacity={0.55} strokeWidth={1.4} />
      ))}
      {preview.n.map(([x, y, w, h, c], i) => (
        <rect key={`n${i}`} x={x} y={y} width={w} height={h} rx={Math.min(h / 2, 4)} fill={c} />
      ))}
    </svg>
  );
}

/** Illustration de l'état vide : une petite carte mentale. */
function EmptyIllustration() {
  const branches = [
    [40, 30, "#ec4899"],
    [40, 110, "#22c55e"],
    [200, 30, "#06b6d4"],
    [200, 110, "#f97316"],
  ] as const;
  return (
    <svg viewBox="0 0 260 150" className="mx-auto h-32 w-auto" aria-hidden="true">
      {branches.map(([x, y, c]) => (
        <path key={`${x}-${y}`} d={`M130 75 C ${(130 + x) / 2} 75, ${(130 + x) / 2} ${y + 10}, ${x + 15} ${y + 10}`} stroke={c} strokeWidth="3" fill="none" opacity="0.7" />
      ))}
      {branches.map(([x, y, c], i) => (
        <rect key={i} x={x - 15} y={y} width="50" height="20" rx="10" fill={c} className="animate-pop" style={{ animationDelay: `${150 + i * 90}ms`, animationFillMode: "backwards" }} />
      ))}
      <rect x="95" y="60" width="70" height="30" rx="12" fill="#4f46e5" className="animate-pop" />
      <rect x="108" y="71" width="44" height="8" rx="4" fill="white" opacity="0.85" />
    </svg>
  );
}

export default function Home() {
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [maps, setMaps] = useState<MapSummary[]>(listMaps);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>(readSort);
  const [newName, setNewName] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [toDelete, setToDelete] = useState<MapSummary | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = () => setMaps(listMaps());

  const shown = useMemo(() => {
    const q = fold(query.trim());
    const filtered = q ? maps.filter((m) => fold(m.name).includes(q)) : maps;
    const sorted = [...filtered];
    if (sort === "recent") sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    if (sort === "old") sorted.sort((a, b) => a.updatedAt - b.updatedAt);
    if (sort === "created") sorted.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
    return sorted;
  }, [maps, query, sort]);

  const changeSort = (value: SortMode) => {
    setSort(value);
    try {
      localStorage.setItem(SORT_KEY, value);
    } catch {
      // Tri non mémorisé : sans importance.
    }
  };

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

  const confirmDelete = () => {
    if (!toDelete) return;
    const backup = loadMap(toDelete.id);
    deleteMap(toDelete.id);
    setToDelete(null);
    refresh();
    toast.success(
      `« ${toDelete.name} » a été supprimée.`,
      backup
        ? {
            label: "Annuler",
            onClick: () => {
              saveMap(backup);
              refresh();
            },
          }
        : undefined,
    );
  };

  const importFile = async (file: File) => {
    try {
      // Chargé à la demande : la page d'accueil reste légère.
      const { parseImport, readFile } = await import("../lib/exporters");
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

  const actionsVisible = "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 pointer-coarse:opacity-100";

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden"
      style={{ paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)", paddingBottom: "var(--safe-bottom)" }}
    >
      {/* Halo décoratif */}
      <div
        className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[min(900px,180vw)] -translate-x-1/2 rounded-full bg-linear-to-br from-indigo-500/25 via-violet-500/15 to-fuchsia-500/20 blur-3xl dark:from-indigo-500/20 dark:via-violet-600/10 dark:to-fuchsia-600/15"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center gap-2 px-4 pt-[calc(0.75rem+var(--safe-top))] sm:px-6">
        <img src="/icons/icon.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-xl shadow-md shadow-indigo-500/30" />
        <span className="text-lg font-bold tracking-tight">ecoleduc</span>
        <div className="ml-auto flex items-center gap-1">
          <InstallApp />
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="relative mx-auto flex max-w-5xl flex-col px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        <section className="flex flex-col items-center text-center">
          <h1 className="animate-slide-up text-5xl font-extrabold tracking-tight sm:text-6xl">
            <span className="bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">ecoleduc</span>
          </h1>
          <p className="mt-3 max-w-md animate-slide-up text-balance text-base text-slate-600 sm:text-lg dark:text-slate-300">
            Tes idées, rangées en cartes mentales claires et colorées — au doigt ou à la souris.
          </p>
          <div className="mt-8 flex w-full animate-slide-up flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setNewName("")}
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-linear-to-r from-indigo-600 to-violet-600 px-7 text-lg font-semibold text-white shadow-xl shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-600/40 active:translate-y-0 active:scale-[0.99]"
            >
              <PlusIcon size={22} strokeWidth={2.5} className="transition group-hover:rotate-90" />
              Nouvelle carte mentale
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-5 text-sm font-medium text-slate-700 backdrop-blur transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-indigo-500/60 dark:hover:text-indigo-300"
            >
              <UploadIcon size={16} /> Importer un fichier JSON
            </button>
          </div>
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
        </section>

        <section className="mt-14 w-full" aria-labelledby="mes-cartes">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="mes-cartes" className="mr-auto text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Mes cartes {maps.length > 0 && <span className="ml-1 text-slate-400 dark:text-slate-500">({maps.length})</span>}
            </h2>
            {maps.length > 0 && (
              <div className="flex w-full gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                  <span className="sr-only">Rechercher dans mes cartes</span>
                  <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher…"
                    enterKeyHint="search"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/80 pr-3 pl-9 text-base outline-none transition focus:border-indigo-400 sm:text-sm dark:border-slate-700 dark:bg-slate-900/70"
                  />
                </label>
                <label className="relative shrink-0">
                  <span className="sr-only">Trier mes cartes</span>
                  <select
                    value={sort}
                    onChange={(e) => changeSort(e.target.value as SortMode)}
                    aria-label="Trier mes cartes"
                    className="h-11 w-40 appearance-none rounded-xl border border-slate-200 bg-white/80 pr-8 pl-3 text-base text-slate-700 outline-none transition focus:border-indigo-400 sm:text-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </label>
              </div>
            )}
          </div>

          {maps.length === 0 ? (
            <div className="animate-fade-in rounded-3xl border border-dashed border-slate-300 bg-white/50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <EmptyIllustration />
              <p className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">Ta première carte t'attend</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Commence par une idée centrale, puis ajoute des branches. Tout est enregistré automatiquement sur cet appareil.
              </p>
              <button type="button" onClick={() => setNewName("")} className={`${btn.primary} mt-6`}>
                <PlusIcon size={16} strokeWidth={2.5} /> Créer ma première carte
              </button>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <p>Aucune carte ne correspond à « {query} ».</p>
              <button type="button" onClick={() => setQuery("")} className={`${btn.secondary} mt-4`}>
                <XIcon size={15} /> Effacer la recherche
              </button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((m, i) => (
                <li
                  key={m.id}
                  className="group relative animate-slide-up overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-indigo-500/50"
                  style={{ animationDelay: `${Math.min(i, 10) * 30}ms`, animationFillMode: "backwards" }}
                >
                  <button
                    type="button"
                    onClick={() => renaming?.id !== m.id && openMap(m.id)}
                    className="block w-full text-left"
                    aria-label={`Ouvrir ${m.name}`}
                    tabIndex={renaming?.id === m.id ? -1 : 0}
                  >
                    <div className="h-28 border-b border-slate-100 bg-[var(--mm-canvas)] p-2 dark:border-slate-800">
                      <MapThumbnail preview={m.preview} />
                    </div>
                  </button>
                  <div className="flex items-center gap-1 py-2 pr-1.5 pl-4">
                    {renaming?.id === m.id ? (
                      <div className="min-w-0 flex-1 py-1">
                        <input
                          autoFocus
                          value={renaming.value}
                          onChange={(e) => setRenaming({ id: m.id, value: e.target.value })}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          enterKeyHint="done"
                          aria-label="Nouveau nom"
                          className="h-11 w-full rounded-lg border border-indigo-400 bg-transparent px-2 text-base font-semibold outline-none"
                        />
                      </div>
                    ) : (
                      <button type="button" onClick={() => openMap(m.id)} className="min-w-0 flex-1 py-1 text-left" tabIndex={-1}>
                        <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{m.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                          Modifiée {formatDate(m.updatedAt)} · {m.nodeCount} idée{m.nodeCount > 1 ? "s" : ""}
                        </span>
                      </button>
                    )}
                    {renaming?.id !== m.id && (
                      <div className={`flex shrink-0 transition ${actionsVisible}`}>
                        <button
                          type="button"
                          className={`${btn.icon} tap:h-11 tap:w-11`}
                          title="Renommer"
                          aria-label={`Renommer ${m.name}`}
                          onClick={() => setRenaming({ id: m.id, value: m.name })}
                        >
                          <PencilIcon size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${btn.icon} hover:text-red-600 dark:hover:text-red-400`}
                          title="Supprimer"
                          aria-label={`Supprimer ${m.name}`}
                          onClick={() => setToDelete(m)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    )}
                  </div>
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
            Nom de la carte (ce sera l'idée centrale)
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Nouvelle carte mentale"
              maxLength={120}
              enterKeyHint="go"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-base text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:text-white"
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
              <button className={btn.danger} onClick={confirmDelete}>
                <TrashIcon size={16} /> Supprimer
              </button>
            </>
          }
        >
          <div className="mb-4 h-28 overflow-hidden rounded-xl border border-slate-200 bg-[var(--mm-canvas)] p-2 dark:border-slate-800">
            <MapThumbnail preview={toDelete.preview} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            « {toDelete.name} » ({toDelete.nodeCount} idée{toDelete.nodeCount > 1 ? "s" : ""}) sera supprimée de cet appareil. Pense à
            l'exporter en JSON si tu veux en garder une copie.
          </p>
        </Modal>
      )}
    </div>
  );
}
