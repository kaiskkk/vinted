import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { crosswordWord } from "../../../shared/study";
import { CheckIcon, EyeIcon, RefreshIcon, TrophyIcon } from "../../components/Icons";
import { btn } from "../../components/Modal";
import { ShareButton } from "../../components/ShareButton";
import { useToast } from "../../components/Toasts";
import { Page, PageHeader, Segmented, card } from "../../components/ui";
import { useDoc } from "../../hooks/useDoc";
import { buildCrossword, cellsOf, type PlacedWord } from "../../lib/crossword";
import { shuffle, type JeuDoc } from "../../lib/docs";
import { fold } from "../../lib/format";
import { recordActivity } from "../../lib/serie";

type Game = "paires" | "trous" | "mots";
const PAIRS_PER_ROUND = 6;

const formatTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
};

function Result({ title, detail, record, onReplay }: { title: string; detail: string; record?: string; onReplay: () => void }) {
  return (
    <div className={`${card} animate-pop p-6 text-center`} role="status">
      <TrophyIcon size={40} className="mx-auto text-amber-500" />
      <p className="mt-2 text-xl font-bold">{title}</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">{detail}</p>
      {record && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{record}</p>}
      <button type="button" className={`${btn.primary} mt-4`} onClick={onReplay}>
        <RefreshIcon size={15} /> Rejouer
      </button>
    </div>
  );
}

// ---------- Paires ----------

function PairsGame({ doc, onRecord }: { doc: JeuDoc; onRecord: (ms: number) => void }) {
  const [round, setRound] = useState(0);
  const pairs = useMemo(() => shuffle(doc.paires).slice(0, PAIRS_PER_ROUND), [doc.paires, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const defs = useMemo(() => shuffle(pairs), [pairs]);
  const [term, setTerm] = useState<string | null>(null);
  const [def, setDef] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<{ term: string; def: string } | null>(null);
  const [errors, setErrors] = useState(0);
  const [start, setStart] = useState<number | null>(null);
  const [time, setTime] = useState<number | null>(null);

  const restart = () => {
    setRound((r) => r + 1);
    setTerm(null);
    setDef(null);
    setMatched(new Set());
    setWrong(null);
    setErrors(0);
    setStart(null);
    setTime(null);
  };

  const pick = (side: "term" | "def", id: string) => {
    if (matched.has(id) || wrong) return;
    const began = start ?? Date.now();
    if (start === null) setStart(began);
    const t = side === "term" ? id : term;
    const d = side === "def" ? id : def;
    if (side === "term") setTerm(id);
    else setDef(id);
    if (!t || !d) return;
    if (t === d) {
      const next = new Set(matched).add(t);
      setMatched(next);
      setTerm(null);
      setDef(null);
      if (next.size === pairs.length) {
        const ms = Date.now() - began;
        setTime(ms);
        onRecord(ms);
        recordActivity("jeu");
      }
    } else {
      setErrors((e) => e + 1);
      setWrong({ term: t, def: d });
      setTimeout(() => {
        setWrong(null);
        setTerm(null);
        setDef(null);
      }, 700);
    }
  };

  if (time !== null) {
    return (
      <Result
        title="Toutes les paires trouvées !"
        detail={`${pairs.length} paires en ${formatTime(time)}, ${errors} erreur${errors > 1 ? "s" : ""}.`}
        record={doc.records.paires ? `Ton record : ${formatTime(doc.records.paires)}` : undefined}
        onReplay={restart}
      />
    );
  }

  const tile = (side: "term" | "def", id: string, text: string) => {
    const isMatched = matched.has(id);
    const selected = side === "term" ? term === id : def === id;
    const isWrong = wrong && (side === "term" ? wrong.term === id : wrong.def === id);
    return (
      <button
        key={`${side}-${id}`}
        type="button"
        onClick={() => pick(side, id)}
        disabled={isMatched}
        aria-pressed={selected}
        className={`min-h-14 w-full rounded-xl border-2 px-3 py-2 text-left text-sm transition active:scale-[0.98] ${
          isMatched
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 opacity-70 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
            : isWrong
              ? "animate-[shake_0.35s] border-red-400 bg-red-50 dark:bg-red-500/10"
              : selected
                ? "border-lime-500 bg-lime-50 dark:bg-lime-500/10"
                : "border-slate-200 bg-white hover:border-lime-300 dark:border-slate-700 dark:bg-slate-900"
        } ${side === "term" ? "font-semibold" : ""}`}
      >
        {text}
      </button>
    );
  };

  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Touche un mot à gauche, puis sa définition à droite. {matched.size}/{pairs.length} · {errors} erreur{errors > 1 ? "s" : ""}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
        <div className="space-y-2">{pairs.map((p) => tile("term", p.id, p.terme))}</div>
        <div className="space-y-2">{defs.map((p) => tile("def", p.id, p.definition))}</div>
      </div>
    </div>
  );
}

// ---------- Textes à trous ----------

interface Blank {
  id: string;
  answer: string;
}

function ClozeGame({ doc, onRecord }: { doc: JeuDoc; onRecord: (pct: number) => void }) {
  const [round, setRound] = useState(0);
  const phrases = useMemo(
    () =>
      doc.trous.map((t) => {
        const parts = t.texte.split(/\[([^\]\n]+)\]/);
        return parts.map((p, i) => (i % 2 === 1 ? ({ id: `${t.id}-${i}`, answer: p.trim() } as Blank) : p));
      }),
    [doc.trous],
  );
  const blanks = useMemo(() => phrases.flatMap((parts) => parts.filter((p): p is Blank => typeof p !== "string")), [phrases]);
  const bank = useMemo(() => shuffle(blanks.map((b) => ({ id: b.id, word: b.answer }))), [blanks, round]); // eslint-disable-line react-hooks/exhaustive-deps
  // Trou → mot de la banque placé dedans.
  const [fills, setFills] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(blanks[0]?.id ?? null);
  const [checked, setChecked] = useState(false);
  const used = new Set(Object.values(fills));
  const wordOf = (bankId: string) => bank.find((b) => b.id === bankId)?.word ?? "";
  const isRight = (b: Blank) => fills[b.id] !== undefined && fold(wordOf(fills[b.id])) === fold(b.answer);
  const score = blanks.length ? Math.round((blanks.filter(isRight).length / blanks.length) * 100) : 0;

  const place = (bankId: string) => {
    if (checked) return;
    const target = active && !fills[active] ? active : blanks.find((b) => !fills[b.id])?.id;
    if (!target) return;
    const next = { ...fills, [target]: bankId };
    setFills(next);
    setActive(blanks.find((b) => !next[b.id])?.id ?? null);
  };

  const tapBlank = (id: string) => {
    if (checked) return;
    if (fills[id]) {
      const next = { ...fills };
      delete next[id];
      setFills(next);
    }
    setActive(id);
  };

  const check = () => {
    setChecked(true);
    onRecord(score);
    recordActivity("jeu");
  };

  const restart = () => {
    setRound((r) => r + 1);
    setFills({});
    setChecked(false);
    setActive(blanks[0]?.id ?? null);
  };

  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-300">Touche un trou, puis le mot qui va dedans. Touche un mot placé pour l'enlever.</p>
      <ol className="mt-3 space-y-3">
        {phrases.map((parts, i) => (
          <li key={i} className={`${card} p-3 leading-loose`}>
            {parts.map((p, k) =>
              typeof p === "string" ? (
                <span key={k}>{p}</span>
              ) : (
                <span key={k} className="inline-flex flex-col align-middle">
                  <button
                    type="button"
                    onClick={() => tapBlank(p.id)}
                    aria-label={fills[p.id] ? `Trou rempli : ${wordOf(fills[p.id])}` : "Trou à remplir"}
                    className={`mx-0.5 inline-flex min-h-9 min-w-20 tap:min-h-11 items-center justify-center rounded-lg border-2 border-dashed px-2 text-sm font-semibold transition ${
                      checked
                        ? isRight(p)
                          ? "border-solid border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "border-solid border-red-400 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
                        : active === p.id
                          ? "border-lime-500 bg-lime-50 dark:bg-lime-500/10"
                          : fills[p.id]
                            ? "border-solid border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800"
                            : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {fills[p.id] ? wordOf(fills[p.id]) : "…"}
                  </button>
                  {checked && !isRight(p) && (
                    <span className="text-center text-xs font-semibold text-emerald-700 dark:text-emerald-300">{p.answer}</span>
                  )}
                </span>
              ),
            )}
          </li>
        ))}
      </ol>

      {checked ? (
        <div className="mt-4">
          <Result
            title={score === 100 ? "Parfait !" : score >= 60 ? "Bien joué !" : "Continue, tu progresses !"}
            detail={`${score} % de bonnes réponses.`}
            record={doc.records.trous ? `Ton record : ${doc.records.trous} %` : undefined}
            onReplay={restart}
          />
        </div>
      ) : (
        <>
          <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border dark:border-slate-800 dark:bg-slate-900/95">
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Mots à placer</p>
            <div className="flex flex-wrap gap-2">
              {bank.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={used.has(b.id)}
                  onClick={() => place(b.id)}
                  className="min-h-10 rounded-full border border-lime-300 bg-lime-50 px-3 text-sm font-medium text-lime-900 transition active:scale-95 disabled:opacity-25 tap:min-h-11 dark:border-lime-500/40 dark:bg-lime-500/10 dark:text-lime-200"
                >
                  {b.word}
                </button>
              ))}
            </div>
            <button type="button" className={`${btn.primary} mt-3 w-full`} onClick={check} disabled={Object.keys(fills).length === 0}>
              <CheckIcon size={16} /> Vérifier
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Mots croisés ----------

const cellKey = (r: number, c: number) => `${r},${c}`;

function CrosswordGame({ doc, onRecord }: { doc: JeuDoc; onRecord: (ms: number) => void }) {
  const [seed, setSeed] = useState(0);
  const cw = useMemo(() => buildCrossword(doc.motsCroises), [doc.motsCroises, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [letters, setLetters] = useState<Record<string, string>>({});
  const [activeWord, setActiveWord] = useState(0);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [start, setStart] = useState<number | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const word: PlacedWord | undefined = cw.words[activeWord];
  const activeCells = useMemo(() => new Set(word ? cellsOf(word).map(([r, c]) => cellKey(r, c)) : []), [word]);
  const numbers = useMemo(() => new Map(cw.words.map((w) => [cellKey(w.row, w.col), w.number])), [cw]);
  const total = cw.solution.flat().filter(Boolean).length;
  const correct = cw.solution.flatMap((row, r) => row.map((l, c) => (l && letters[cellKey(r, c)] === l ? 1 : 0))).reduce((a: number, b) => a + b, 0);

  useEffect(() => {
    if (time === null && !revealed && total > 0 && correct === total) {
      const ms = Date.now() - (start ?? Date.now());
      setTime(ms);
      onRecord(ms);
      recordActivity("jeu");
    }
  }, [correct, total, time, revealed, start, onRecord]);

  const focusCell = (r: number, c: number) => refs.current[cellKey(r, c)]?.focus();
  const wordsAt = (r: number, c: number) => cw.words.map((w, i) => ({ w, i })).filter(({ w }) => cellsOf(w).some(([a, b]) => a === r && b === c));

  const selectCell = (r: number, c: number) => {
    const here = wordsAt(r, c);
    if (!here.length) return;
    // Toucher à nouveau une case qui est à la croisée de deux mots change de sens.
    const current = here.findIndex(({ i }) => i === activeWord);
    setActiveWord(current >= 0 ? here[(current + 1) % here.length].i : here[0].i);
  };

  const move = (r: number, c: number, delta: number) => {
    if (!word) return;
    const cells = cellsOf(word);
    const k = cells.findIndex(([a, b]) => a === r && b === c);
    const next = cells[k + delta];
    if (next) focusCell(next[0], next[1]);
  };

  const type = (r: number, c: number, value: string) => {
    if (start === null) setStart(Date.now());
    const letter = crosswordWord(value).slice(-1);
    setLetters((l) => ({ ...l, [cellKey(r, c)]: letter }));
    setChecked(false);
    if (letter) move(r, c, 1);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === "Backspace" && !letters[cellKey(r, c)]) {
      e.preventDefault();
      move(r, c, -1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(r, c, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(r, c, -1);
    }
  };

  const restart = () => {
    setSeed((s) => s + 1);
    setLetters({});
    setChecked(false);
    setRevealed(false);
    setStart(null);
    setTime(null);
    setActiveWord(0);
  };

  const reveal = () => {
    const all: Record<string, string> = {};
    cw.solution.forEach((row, r) => row.forEach((l, c) => l && (all[cellKey(r, c)] = l)));
    setLetters(all);
    setRevealed(true);
  };

  if (cw.words.length < 3)
    return <p className="text-slate-600 dark:text-slate-300">Pas assez de mots pour une grille. Génère de nouveaux jeux à partir de ton cours.</p>;

  if (time !== null) {
    return (
      <Result
        title="Grille terminée !"
        detail={`${cw.words.length} mots trouvés en ${formatTime(time)}.`}
        record={doc.records.motsCroises ? `Ton record : ${formatTime(doc.records.motsCroises)}` : undefined}
        onReplay={restart}
      />
    );
  }

  const across = cw.words.map((w, i) => ({ w, i })).filter(({ w }) => w.dir === "across");
  const down = cw.words.map((w, i) => ({ w, i })).filter(({ w }) => w.dir === "down");
  const clueList = (title: string, list: typeof across) => (
    <div>
      <h3 className="text-sm font-bold">{title}</h3>
      <ol className="mt-1 space-y-1">
        {list.map(({ w, i }) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => {
                setActiveWord(i);
                const empty = cellsOf(w).find(([r, c]) => !letters[cellKey(r, c)]) ?? [w.row, w.col];
                focusCell(empty[0], empty[1]);
              }}
              className={`min-h-11 w-full rounded-lg px-2 py-1.5 text-left text-sm transition ${i === activeWord ? "bg-lime-100 font-medium dark:bg-lime-500/15" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <strong>{w.number}.</strong> {w.clue} <span className="text-slate-400">({w.word.length})</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <div>
      {word && (
        <p className="sticky top-[calc(3.5rem+var(--safe-top))] z-10 -mx-4 bg-lime-50/95 px-4 py-2 text-sm backdrop-blur sm:mx-0 sm:rounded-xl dark:bg-lime-500/15">
          <strong>
            {word.number}. {word.dir === "across" ? "Horizontal" : "Vertical"}
          </strong>{" "}
          — {word.clue} ({word.word.length} lettres)
        </p>
      )}
      <div className="mt-3 overflow-x-auto pb-1">
        <div
          className="mx-auto grid gap-px rounded-lg bg-slate-300 p-px dark:bg-slate-700"
          style={{ gridTemplateColumns: `repeat(${cw.cols}, minmax(0, 1fr))`, width: `min(100%, ${cw.cols * 40}px)`, minWidth: `${cw.cols * 26}px` }}
          role="grid"
          aria-label="Grille de mots croisés"
        >
          {cw.solution.flatMap((row, r) =>
            row.map((l, c) => {
              const k = cellKey(r, c);
              if (!l) return <div key={k} className="aspect-square bg-slate-100 dark:bg-slate-950" aria-hidden="true" />;
              const wrong = checked && letters[k] && letters[k] !== l;
              return (
                <div
                  key={k}
                  className={`relative aspect-square ${activeCells.has(k) ? "bg-lime-100 dark:bg-lime-500/20" : "bg-white dark:bg-slate-900"}`}
                >
                  {numbers.has(k) && (
                    <span className="pointer-events-none absolute top-0 left-0.5 text-[9px] leading-none font-bold text-slate-500">
                      {numbers.get(k)}
                    </span>
                  )}
                  <input
                    ref={(el) => {
                      refs.current[k] = el;
                    }}
                    value={letters[k] ?? ""}
                    onChange={(e) => type(r, c, e.target.value)}
                    onKeyDown={(e) => onKey(e, r, c)}
                    onFocus={() => !activeCells.has(k) && selectCell(r, c)}
                    onClick={() => activeCells.has(k) && selectCell(r, c)}
                    maxLength={2}
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-label={`Case ligne ${r + 1}, colonne ${c + 1}`}
                    className={`h-full w-full bg-transparent p-0 text-center text-base font-bold uppercase caret-transparent outline-none focus:bg-lime-300/60 ${wrong ? "text-red-600" : ""}`}
                  />
                </div>
              );
            }),
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={`${btn.primary} flex-1 sm:flex-none`} onClick={() => setChecked(true)}>
          <CheckIcon size={16} /> Vérifier
        </button>
        <button type="button" className={btn.secondary} onClick={reveal}>
          <EyeIcon size={16} /> Solution
        </button>
        <button type="button" className={btn.secondary} onClick={restart}>
          <RefreshIcon size={15} /> Nouvelle grille
        </button>
      </div>
      {checked && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300" role="status">
          {correct}/{total} lettres justes{correct < total ? " : les lettres en rouge sont à corriger." : "."}
        </p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {clueList("Horizontalement", across)}
        {clueList("Verticalement", down)}
      </div>
    </div>
  );
}

// ---------- Page ----------

export function JeuView({ initial, onBack }: { initial: JeuDoc; onBack: () => void }) {
  const toast = useToast();
  const { doc, update } = useDoc(initial, toast.error);
  const games = useMemo(() => {
    const list: { value: Game; label: string }[] = [];
    if (doc.paires.length >= 3) list.push({ value: "paires", label: "Paires" });
    if (doc.trous.length > 0) list.push({ value: "trous", label: "Trous" });
    if (doc.motsCroises.length >= 3) list.push({ value: "mots", label: "Mots croisés" });
    return list;
  }, [doc.paires.length, doc.trous.length, doc.motsCroises.length]);
  const [game, setGame] = useState<Game>(games[0]?.value ?? "paires");

  const record = (field: keyof JeuDoc["records"], value: number, better: (a: number, b: number) => boolean) => {
    const old = doc.records[field];
    if (old !== undefined && !better(value, old)) return;
    update((d) => ({ ...d, records: { ...d.records, [field]: value } }), { history: false });
    if (old !== undefined) toast.success("🏆 Nouveau record !");
  };

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={doc.titre}
        subtitle="Jeux de révision"
        onBack={onBack}
        width="max-w-3xl"
        actions={<ShareButton compact kind="jeu" id={doc.id} titre={doc.titre} />}
      />
      <Page width="max-w-3xl">
        {games.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-300">Ce jeu est vide. Crée de nouveaux jeux à partir de ton cours.</p>
        ) : (
          <>
            {games.length > 1 && <Segmented label="Jeu" value={game} onChange={setGame} oneLine options={games} className="mb-5" />}
            {game === "paires" && <PairsGame doc={doc} onRecord={(ms) => record("paires", ms, (a, b) => a < b)} />}
            {game === "trous" && <ClozeGame doc={doc} onRecord={(pct) => record("trous", pct, (a, b) => a > b)} />}
            {game === "mots" && <CrosswordGame doc={doc} onRecord={(ms) => record("motsCroises", ms, (a, b) => a < b)} />}
          </>
        )}
      </Page>
    </div>
  );
}
