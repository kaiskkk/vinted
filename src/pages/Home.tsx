import { useMemo, useRef, useState } from "react";
import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "../components/Icons";
import { AccountButton } from "../components/AccountButton";
import { InstallApp } from "../components/InstallApp";
import { KIND_LOOK, KindBadge, MODE_INFO } from "../components/looks";
import { btn } from "../components/Modal";
import { SeriePill } from "../components/Serie";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toasts";
import { NiveauPicker, card } from "../components/ui";
import { MODE_IDS, openDoc, openItem, openMode, type Mode } from "../hooks/useHashRoute";
import { useTheme } from "../hooks/useTheme";
import { listClasseurs, listDocs, loadDoc } from "../lib/docs";
import { fold, formatDate, plural } from "../lib/format";
import { isDue } from "../lib/leitner";
import { downloadBackup, importAll, listLibrary, type ItemKind, type LibraryItem } from "../lib/library";
import { today } from "../lib/planning";
import { dayLabel, genreOf, upcomingAgenda } from "../lib/agenda";
import { listMaps } from "../lib/storage";

type Filter =
  | "tout"
  | "classeur"
  | "carte"
  | "fiche"
  | "revision"
  | "quiz"
  | "flashcards"
  | "resume"
  | "exercices"
  | "jeu"
  | "frise"
  | "redaction"
  | "copie";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "tout", label: "Tout" },
  { value: "classeur", label: "Classeurs" },
  { value: "carte", label: "Cartes" },
  { value: "fiche", label: "Fiches" },
  { value: "revision", label: "Révision" },
  { value: "quiz", label: "Quiz" },
  { value: "flashcards", label: "Flashcards" },
  { value: "resume", label: "Résumés" },
  { value: "exercices", label: "Exercices" },
  { value: "jeu", label: "Jeux" },
  { value: "frise", label: "Frises" },
  { value: "redaction", label: "Devoirs" },
  { value: "copie", label: "Copies" },
];
const matches = (f: Filter, kind: ItemKind) => f === "tout" || f === kind || (f === "revision" && kind === "planning");

function modeCounts(items: LibraryItem[]): Record<Mode, number> {
  const count = (kinds: ItemKind[]) => items.filter((i) => kinds.includes(i.kind)).length;
  return {
    general: count(["classeur"]),
    cartes: count(["carte"]),
    fiches: count(["fiche"]),
    revision: count(["revision", "planning"]),
    quiz: count(["quiz"]),
    flashcards: count(["flashcards"]),
    exercices: count(["exercices"]),
    jeux: count(["jeu"]),
    frise: count(["frise"]),
    redaction: count(["redaction"]),
    copie: count(["copie"]),
    agenda: upcomingAgenda().length,
  };
}

interface TodayItem {
  id: string;
  kind: ItemKind;
  titre: string;
  texte: string;
}

/** Ce qui est prévu aujourd'hui : cartes à revoir, séances du planning. */
function todayItems(): TodayItem[] {
  const out: TodayItem[] = [];
  const day = today();
  for (const d of listDocs()) {
    if (d.type !== "flashcards" && d.type !== "planning") continue;
    const doc = loadDoc(d.id);
    if (doc?.type === "flashcards") {
      const n = doc.cartes.filter((c) => isDue(c)).length;
      if (n) out.push({ id: doc.id, kind: "flashcards", titre: doc.titre, texte: `${plural(n, "carte")} à travailler` });
    } else if (doc?.type === "planning") {
      const jour = doc.jours.find((j) => j.date === day);
      if (!jour) continue;
      if (jour.taches.some((t) => t.genre === "examen")) {
        out.push({ id: doc.id, kind: "planning", titre: doc.titre, texte: "C'est le jour J : bonne chance !" });
        continue;
      }
      const todo = jour.taches.filter((t) => !t.fait).length;
      if (todo)
        out.push({ id: doc.id, kind: "planning", titre: doc.titre, texte: `${plural(todo, "séance prévue", "séances prévues")} aujourd'hui` });
    }
  }
  return out.slice(0, 4);
}

export default function Home() {
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<LibraryItem[]>(listLibrary);
  const [todo] = useState<TodayItem[]>(todayItems);
  const [devoirs] = useState(() => upcomingAgenda());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("tout");
  const [showAll, setShowAll] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => modeCounts(items), [items]);
  const classeurNames = useMemo(() => new Map(listClasseurs().map((c) => [c.id, c.nom])), [items]);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    return items.filter((i) => matches(filter, i.kind) && (!q || fold(i.titre).includes(q)));
  }, [items, query, filter]);
  const visible = showAll || query || filter !== "tout" ? shown : shown.slice(0, 8);

  const restoreBackup = async (file: File) => {
    try {
      const text = await file.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Ce fichier n'est pas un JSON valide.");
      }
      const format = (data as { format?: unknown })?.format;
      if (format !== "ecoleduc-sauvegarde") {
        // Une carte mentale seule : on l'importe comme dans le mode Carte mentale.
        const { parseImport } = await import("../lib/exporters");
        const { DEFAULT_EDGE, newId } = await import("../lib/mapModel");
        const { saveMap } = await import("../lib/storage");
        const content = parseImport(text, DEFAULT_EDGE);
        const now = Date.now();
        saveMap({ id: newId(), createdAt: now, updatedAt: now, ...content });
        toast.success(`Carte « ${content.name} » importée.`);
      } else {
        const r = importAll(data);
        const total = r.cartes + r.documents + r.classeurs;
        toast.success(
          total
            ? `Sauvegarde restaurée : ${plural(r.classeurs, "classeur")}, ${plural(r.cartes, "carte")}, ${plural(r.documents, "document")}.`
            : "Tout était déjà à jour : rien de nouveau dans cette sauvegarde.",
        );
      }
      setItems(listLibrary());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    }
  };

  const hasMaps = listMaps().length > 0;

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden"
      style={{ paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)", paddingBottom: "var(--safe-bottom)" }}
    >
      <div
        className="pointer-events-none absolute -top-48 left-1/2 h-[520px] w-[min(900px,180vw)] -translate-x-1/2 rounded-full bg-linear-to-br from-indigo-500/25 via-violet-500/15 to-fuchsia-500/20 blur-3xl dark:from-indigo-500/20 dark:via-violet-600/10 dark:to-fuchsia-600/15"
        aria-hidden="true"
      />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center gap-2 px-4 pt-[calc(0.75rem+var(--safe-top))] sm:px-6">
        <img src="/icons/icon.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-xl shadow-md shadow-indigo-500/30" />
        {/* Sur téléphone, le nom est déjà en grand juste en dessous : la place va aux boutons. */}
        <span className="hidden text-lg font-bold tracking-tight sm:inline">ecoleduc</span>
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <SeriePill />
          <NiveauPicker />
          {/* Très petits écrans : le thème suit déjà celui du téléphone, le bouton laisse la place au compte. */}
          <span className="contents max-[359px]:hidden">
            <ThemeToggle theme={theme} onToggle={toggle} />
          </span>
          <AccountButton />
        </div>
      </header>

      <main className="relative mx-auto flex max-w-5xl flex-col px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        <section className="text-center">
          <h1 className="animate-slide-up text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">ecoleduc</span>
          </h1>
          <p className="mx-auto mt-2 max-w-md animate-slide-up text-balance text-slate-600 sm:text-lg dark:text-slate-300">
            Qu'est-ce qu'on révise aujourd'hui ?
          </p>
        </section>

        {todo.length + devoirs.length > 0 && (
          <section className="mt-8" aria-labelledby="aujourdhui">
            <h2
              id="aujourdhui"
              className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
            >
              <ClockIcon size={15} /> Aujourd'hui
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {devoirs.map((d) => {
                const g = genreOf(d.genre);
                const late = d.date < today();
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => openMode("agenda")}
                      className={`${card} flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-md`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-base shadow-sm ${MODE_INFO.agenda.gradient}`}
                        aria-hidden="true"
                      >
                        {g.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{d.titre}</span>
                        <span
                          className={`block truncate text-xs ${late ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
                        >
                          {g.label}
                          {d.matiere && ` de ${d.matiere}`} · {late ? "en retard" : dayLabel(d.date)}
                          {d.heure && ` à ${d.heure.replace(":", "h")}`}
                        </span>
                      </span>
                      <ChevronRightIcon size={18} className="shrink-0 text-slate-400" />
                    </button>
                  </li>
                );
              })}
              {todo.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openDoc(t.id)}
                    className={`${card} flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-md`}
                  >
                    <KindBadge kind={t.kind} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{t.texte}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{t.titre}</span>
                    </span>
                    <ChevronRightIcon size={18} className="shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8" aria-label="Modes">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {MODE_IDS.map((mode, i) => {
              const m = MODE_INFO[mode];
              return (
                <li key={mode} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}>
                  <button
                    type="button"
                    onClick={() => openMode(mode)}
                    className={`${card} group relative flex h-full min-h-36 w-full flex-col items-start overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] sm:min-h-40 sm:p-5`}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg transition group-hover:scale-105 ${m.gradient} ${m.shadow}`}
                    >
                      {m.icon(24)}
                    </span>
                    <span className="mt-3 text-base font-semibold sm:text-lg">{m.label}</span>
                    <span className="mt-0.5 line-clamp-2 text-xs text-slate-500 sm:text-sm dark:text-slate-400">{m.description}</span>
                    {counts[mode] > 0 && (
                      <span className={`absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-semibold ${m.soft}`}>{counts[mode]}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="recents">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="recents" className="mr-auto text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Mes documents récents
            </h2>
            {items.length > 0 && (
              <div className="flex w-full gap-2 sm:w-64">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Rechercher dans mes documents</span>
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
                {/* Sur téléphone, un menu déroulant remplace les pastilles. */}
                <label className="relative shrink-0 sm:hidden">
                  <span className="sr-only">Type de document</span>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as Filter)}
                    aria-label="Type de document"
                    className="h-11 w-32 appearance-none rounded-xl border border-slate-200 bg-white/80 pr-8 pl-3 text-base text-slate-700 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                  >
                    {FILTERS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon size={16} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400" />
                </label>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="mb-3 hidden flex-wrap gap-1.5 sm:flex" role="radiogroup" aria-label="Filtrer par type">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={`min-h-9 rounded-full border px-3.5 text-sm font-medium transition tap:min-h-11 ${
                    filter === f.value
                      ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                      : "border-slate-200 bg-white/80 text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <div className="animate-fade-in rounded-3xl border border-dashed border-slate-300 bg-white/50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">Rien ici pour l'instant</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Commence par le mode <strong>Général</strong> : ajoute ton cours, et l'IA prépare fiches, quiz et flashcards.
              </p>
              <button type="button" onClick={() => openMode("general")} className={`${btn.primary} mt-6`}>
                <PlusIcon size={16} strokeWidth={2.5} /> Ajouter un cours
              </button>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <p>Aucun document ne correspond.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("tout");
                }}
                className={`${btn.secondary} mt-4`}
              >
                <XIcon size={15} /> Tout afficher
              </button>
            </div>
          ) : (
            <>
              <ul className={`${card} divide-y divide-slate-100 overflow-hidden dark:divide-slate-800`}>
                {visible.map((item) => {
                  const classeur = item.classeurId ? classeurNames.get(item.classeurId) : undefined;
                  return (
                    <li key={`${item.kind}-${item.id}`}>
                      <button
                        type="button"
                        onClick={() => openItem(item.kind, item.id)}
                        className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 sm:px-4 dark:hover:bg-slate-800/60 dark:active:bg-slate-800"
                      >
                        <KindBadge kind={item.kind} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{item.titre}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {KIND_LOOK[item.kind].label} · {formatDate(item.updatedAt)}
                            {classeur ? ` · ${classeur}` : ""}
                          </span>
                        </span>
                        <ChevronRightIcon size={18} className="shrink-0 text-slate-400" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {visible.length < shown.length && (
                <button type="button" onClick={() => setShowAll(true)} className={`${btn.secondary} mt-3 w-full`}>
                  Voir tout ({shown.length})
                </button>
              )}
            </>
          )}
        </section>

        <section className="mt-12" aria-labelledby="donnees">
          <h2 id="donnees" className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            <ArchiveIcon size={15} /> Mes données
          </h2>
          <div className={`${card} p-4`}>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Tout est enregistré sur cet appareil. Fais une sauvegarde de temps en temps pour ne rien perdre, ou pour tout retrouver sur un autre
              appareil.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className={btn.secondary}
                onClick={() => {
                  void downloadBackup().then(() => toast.success("Sauvegarde téléchargée."));
                }}
                disabled={items.length === 0 && !hasMaps}
              >
                <DownloadIcon size={16} /> Sauvegarder tout (JSON)
              </button>
              <button type="button" className={btn.secondary} onClick={() => importRef.current?.click()}>
                <UploadIcon size={16} /> Restaurer une sauvegarde
              </button>
              <InstallApp />
            </div>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void restoreBackup(f);
                e.target.value = "";
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
