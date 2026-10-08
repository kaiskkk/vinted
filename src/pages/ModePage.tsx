import { useMemo, useState, type ReactNode } from "react";
import { DIFFICULTES, type Difficulte, type TypeEtude } from "../../shared/study";
import { DocList } from "../components/DocList";
import { CalendarIcon, ChevronRightIcon, PencilIcon, SearchIcon, SparklesIcon } from "../components/Icons";
import { MODE_INFO } from "../components/looks";
import { MicButton } from "../components/MicButton";
import { btn } from "../components/Modal";
import { SourcePicker, emptySource, hasSource, type SourceValue } from "../components/SourcePicker";
import { useToast } from "../components/Toasts";
import { ClaudeTaskOverlay, EmptyState, NiveauPicker, Page, PageHeader, Segmented, card, input, useClaudeTask, useNiveau } from "../components/ui";
import { goHome, openDoc, type Mode } from "../hooks/useHashRoute";
import { blankDeck, blankFiche, blankFrise, listClasseurs, loadClasseur, newPlanning, saveDoc, touchClasseur, type DocType } from "../lib/docs";
import { fold } from "../lib/format";
import { generateDoc } from "../lib/generate";
import { listLibrary } from "../lib/library";
import { addDays, buildPlanning, parseChapitres, today } from "../lib/planning";

type StudyMode = Exclude<Mode, "general" | "cartes" | "redaction">;

interface ModeConfig {
  kinds: DocType[];
  type: TypeEtude;
  /** « Claude prépare ta fiche… » */
  loading: string;
  createLabel: string;
  createHint: string;
  nombres?: number[];
  defaultNombre?: number;
  difficulte?: boolean;
  empty: string;
}

const CONFIG: Record<StudyMode, ModeConfig> = {
  fiches: {
    kinds: ["fiche"],
    type: "fiche",
    loading: "L'IA prépare ta fiche…",
    createLabel: "Créer une fiche avec l'IA",
    createHint: "Notions clés, définitions, dates, formules, exemples et pièges, à partir de ton cours.",
    empty: "Une fiche claire et colorée, prête à imprimer, à partir de ton cours ou d'un simple sujet.",
  },
  revision: {
    kinds: ["revision", "planning"],
    type: "revision",
    loading: "L'IA condense ton cours…",
    createLabel: "Fiche de révision express",
    createHint: "L'essentiel sur une page et les 10 choses à savoir absolument.",
    empty: "L'essentiel de ton cours sur une seule page, et un planning jour par jour jusqu'à l'examen.",
  },
  quiz: {
    kinds: ["quiz"],
    type: "quiz",
    loading: "L'IA prépare ton quiz…",
    createLabel: "Créer un quiz avec l'IA",
    createHint: "Des QCM corrigés et expliqués, au niveau de difficulté que tu choisis.",
    nombres: [5, 10, 15, 20],
    defaultNombre: 10,
    difficulte: true,
    empty: "Teste tes connaissances avec des QCM corrigés, puis revois tes erreurs.",
  },
  flashcards: {
    kinds: ["flashcards"],
    type: "flashcards",
    loading: "L'IA prépare tes flashcards…",
    createLabel: "Créer des flashcards avec l'IA",
    createHint: "Question au recto, réponse au verso, révisées au bon moment.",
    nombres: [10, 20, 30],
    defaultNombre: 20,
    empty: "Des cartes recto / verso à retourner d'un tap, revues au bon moment grâce à la répétition espacée.",
  },
  frise: {
    kinds: ["frise"],
    type: "frise",
    loading: "L'IA trace ta frise…",
    createLabel: "Créer une frise avec l'IA",
    createHint: "Les événements et les grandes périodes, à partir d'un thème ou de ton cours.",
    empty: "Une frise chronologique claire, modifiable et prête à imprimer, à partir d'un thème ou de ton cours.",
  },
};

type View = "list" | "claude" | "planning";

export default function ModePage({ mode }: { mode: StudyMode }) {
  const info = MODE_INFO[mode];
  const config = CONFIG[mode];
  const toast = useToast();
  const [items, setItems] = useState(() => listLibrary().filter((i) => config.kinds.includes(i.kind as DocType)));
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const refresh = () => setItems(listLibrary().filter((i) => config.kinds.includes(i.kind as DocType)));

  const shown = useMemo(() => {
    const q = fold(query.trim());
    return q ? items.filter((i) => fold(i.titre).includes(q)) : items;
  }, [items, query]);

  const createBlank = () => {
    try {
      const doc = mode === "fiches" ? blankFiche() : mode === "frise" ? blankFrise() : blankDeck();
      saveDoc(doc);
      openDoc(doc.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    }
  };

  if (view === "claude") return <ClaudeForm mode={mode} onCancel={() => setView("list")} />;
  if (view === "planning") return <PlanningForm onCancel={() => setView("list")} />;

  const actions: { label: string; hint: string; icon: ReactNode; onClick: () => void; primary?: boolean }[] = [
    { label: config.createLabel, hint: config.createHint, icon: <SparklesIcon size={22} />, onClick: () => setView("claude"), primary: true },
  ];
  if (mode === "revision") {
    actions.push({
      label: "Planning de révision",
      hint: "Un programme jour par jour jusqu'à la date de ton examen.",
      icon: <CalendarIcon size={22} />,
      onClick: () => setView("planning"),
    });
  }
  if (mode === "fiches" || mode === "flashcards" || mode === "frise") {
    actions.push({
      label: mode === "fiches" ? "Fiche vierge" : mode === "frise" ? "Frise vierge" : "Paquet vide",
      hint:
        mode === "fiches"
          ? "Écris ta fiche toi-même, bloc par bloc."
          : mode === "frise"
            ? "Ajoute toi-même les dates et les périodes."
            : "Écris tes propres cartes recto / verso.",
      icon: <PencilIcon size={22} />,
      onClick: createBlank,
    });
  }

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
          <p className="text-balance text-slate-600 dark:text-slate-300">{config.empty}</p>
        </section>

        <section className={`mt-6 grid gap-3 ${actions.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={`group flex min-h-20 items-center gap-4 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 active:scale-[0.99] ${
                a.primary ? `bg-linear-to-r text-white shadow-lg hover:shadow-xl ${info.gradient} ${info.shadow}` : `${card} hover:shadow-md`
              }`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.primary ? "bg-white/20" : info.soft}`}>
                {a.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.label}</span>
                <span className={`mt-0.5 block text-sm ${a.primary ? "text-white/85" : "text-slate-500 dark:text-slate-400"}`}>{a.hint}</span>
              </span>
              <ChevronRightIcon
                size={20}
                className={`shrink-0 transition group-hover:translate-x-0.5 ${a.primary ? "text-white/80" : "text-slate-400"}`}
              />
            </button>
          ))}
        </section>

        <section className="mt-10" aria-labelledby="mes-docs">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="mes-docs" className="mr-auto text-sm font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Mes documents {items.length > 0 && <span className="ml-1 text-slate-400 dark:text-slate-500">({items.length})</span>}
            </h2>
            {items.length > 4 && (
              <label className="relative w-full sm:w-60">
                <span className="sr-only">Rechercher</span>
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
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={<span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${info.soft}`}>{info.icon(24)}</span>}
              title="Rien pour l'instant"
            >
              Tes documents apparaîtront ici. Ceux créés depuis un classeur du mode Général y sont aussi.
            </EmptyState>
          ) : shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 px-6 py-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Aucun document ne correspond à « {query} ».
            </p>
          ) : (
            <DocList items={shown} onChange={refresh} showType={mode === "revision"} />
          )}
        </section>
      </Page>
    </div>
  );
}

// ---------- Création avec Claude ----------

function ClaudeForm({ mode, onCancel }: { mode: StudyMode; onCancel: () => void }) {
  const info = MODE_INFO[mode];
  const config = CONFIG[mode];
  const toast = useToast();
  const task = useClaudeTask();
  const [niveau] = useNiveau();
  const classeurs = useMemo(listClasseurs, []);
  const [origine, setOrigine] = useState<"nouveau" | "classeur">("nouveau");
  const [classeurId, setClasseurId] = useState(classeurs[0]?.id ?? "");
  const [source, setSource] = useState<SourceValue>(emptySource);
  const [nombre, setNombre] = useState(config.defaultNombre ?? 10);
  const [difficulte, setDifficulte] = useState<Difficulte>("moyen");
  const [consigne, setConsigne] = useState("");

  const submit = () => {
    let src: SourceValue = source;
    let linkTo: string | undefined;
    if (origine === "classeur") {
      const c = loadClasseur(classeurId);
      if (!c) return toast.error("Choisis d'abord un classeur.");
      src = { cours: c.cours, sujet: c.sujet || c.nom, fichiers: c.fichiers };
      linkTo = c.id;
    }
    if (!hasSource(src)) return toast.error("Ajoute d'abord ton cours, un fichier ou un sujet.");
    void task.run(config.loading, async (signal) => {
      const doc = await generateDoc(
        config.type,
        { cours: src.cours, sujet: src.sujet },
        niveau,
        {
          ...(config.nombres ? { nombre } : {}),
          ...(config.difficulte ? { difficulte } : {}),
          ...(consigne.trim() ? { consigne: consigne.trim() } : {}),
        },
        linkTo,
        signal,
      );
      openDoc(doc.id);
    });
  };

  return (
    <div className="min-h-dvh">
      <PageHeader title={config.createLabel} onBack={onCancel} backLabel="Annuler" width="max-w-3xl" />
      <Page width="max-w-3xl">
        <div className="space-y-6">
          {classeurs.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">À partir de…</h2>
              <Segmented
                label="Origine du contenu"
                value={origine}
                onChange={setOrigine}
                options={[
                  { value: "nouveau", label: "Un nouveau contenu" },
                  { value: "classeur", label: "Un de mes classeurs" },
                ]}
              />
            </section>
          )}

          {origine === "classeur" && classeurs.length > 0 ? (
            <section>
              <label className="block text-sm font-semibold" htmlFor="classeur">
                Classeur
              </label>
              <select id="classeur" value={classeurId} onChange={(e) => setClasseurId(e.target.value)} className={`${input} mt-2 h-12`}>
                {classeurs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Le document sera rangé dans ce classeur.</p>
            </section>
          ) : (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Ton cours</h2>
              <SourcePicker value={source} onChange={setSource} onError={(m) => toast.error(m)} />
            </section>
          )}

          {config.nombres && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">{mode === "quiz" ? "Nombre de questions" : "Nombre de cartes"}</h2>
              <Segmented label="Nombre" value={nombre} onChange={setNombre} options={config.nombres.map((n) => ({ value: n, label: String(n) }))} />
            </section>
          )}

          {config.difficulte && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Difficulté</h2>
              <Segmented label="Difficulté" value={difficulte} onChange={setDifficulte} options={DIFFICULTES} />
            </section>
          )}

          <section>
            <label className="block text-sm font-semibold" htmlFor="consigne">
              Une précision ? <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
            </label>
            <div className="mt-2 flex items-center gap-1">
              <input
                id="consigne"
                value={consigne}
                onChange={(e) => setConsigne(e.target.value.slice(0, 300))}
                placeholder={mode === "frise" ? "Ex. de 1789 à 1815, seulement les batailles…" : "Ex. insiste sur les dates, seulement la partie 2…"}
                enterKeyHint="done"
                className={`${input} h-12`}
              />
              <MicButton value={consigne} max={300} onChange={setConsigne} label="Dicter ta précision" />
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center dark:border-slate-800">
            <NiveauPicker />
            <div className="hidden flex-1 sm:block" />
            <button type="button" className={btn.secondary} onClick={onCancel}>
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={task.busy}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 ${info.gradient} ${info.shadow}`}
            >
              <SparklesIcon size={18} /> Générer avec l'IA
            </button>
          </div>
        </div>
      </Page>
      <ClaudeTaskOverlay task={task} />
    </div>
  );
}

// ---------- Planning (calculé sur l'appareil) ----------

export function PlanningForm({
  onCancel,
  classeurId,
  initialChapitres = "",
}: {
  onCancel: () => void;
  classeurId?: string;
  initialChapitres?: string;
}) {
  const toast = useToast();
  const [titre, setTitre] = useState("");
  const [examen, setExamen] = useState(addDays(today(), 14));
  const [debut, setDebut] = useState(today());
  const [chapitres, setChapitres] = useState(initialChapitres);

  const submit = () => {
    try {
      const list = parseChapitres(chapitres);
      if (!list.length) throw new Error("Ajoute au moins un chapitre (un par ligne).");
      const jours = buildPlanning(list, debut, examen);
      const doc = newPlanning(titre.trim() || "Planning de révision", { dateExamen: examen, debut, chapitres: list, jours }, classeurId);
      saveDoc(doc);
      touchClasseur(classeurId);
      openDoc(doc.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Planning impossible.");
    }
  };

  return (
    <div className="min-h-dvh">
      <PageHeader title="Planning de révision" onBack={onCancel} backLabel="Annuler" width="max-w-3xl" />
      <Page width="max-w-3xl">
        <div className="space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Chaque chapitre est appris un jour, puis revu le lendemain, 3 jours et 7 jours plus tard. La veille de l'examen est réservée au bilan.
          </p>
          <label className="block text-sm font-semibold">
            Nom de l'examen
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. Brevet blanc de maths"
              className={`${input} mt-2 h-12 font-normal`}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Date de l'examen
              <input
                type="date"
                value={examen}
                min={addDays(debut, 1)}
                onChange={(e) => setExamen(e.target.value)}
                className={`${input} mt-2 h-12 font-normal`}
              />
            </label>
            <label className="block text-sm font-semibold">
              Je commence le
              <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={`${input} mt-2 h-12 font-normal`} />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Chapitres à réviser <span className="font-normal text-slate-500 dark:text-slate-400">(un par ligne)</span>
            <textarea
              value={chapitres}
              onChange={(e) => setChapitres(e.target.value)}
              rows={6}
              placeholder={"Les fractions\nLe théorème de Pythagore\nLes équations"}
              className={`${input} mt-2 resize-y py-3 font-normal leading-relaxed`}
            />
          </label>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
            <button type="button" className={btn.secondary} onClick={onCancel}>
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-rose-500 to-pink-500 px-5 font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110 active:scale-[0.98]"
            >
              <CalendarIcon size={18} /> Créer mon planning
            </button>
          </div>
        </div>
      </Page>
    </div>
  );
}
