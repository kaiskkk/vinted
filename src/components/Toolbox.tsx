import { useState, type DragEvent, type ReactNode } from "react";
import { BG_PALETTE, TEXT_PALETTE } from "../lib/colors";
import { SHAPES } from "../lib/mapModel";
import { DRAG_MIME, type DragPayload, type EdgePath, type MindEdgeData, type MindNodeData, type Shape } from "../types";
import { KeyboardIcon } from "./Icons";

export const SHAPE_LABELS: Record<Shape, string> = {
  circle: "Rond",
  rectangle: "Rectangle",
  rounded: "Arrondi",
  diamond: "Losange",
  cloud: "Nuage",
  postit: "Post-it",
};

const EMOJIS = [
  "💡", "⭐", "🎯", "🚀", "✅", "❌", "⚠️", "❓", "❗", "📌", "📅", "⏰",
  "💰", "📈", "🏆", "❤️", "🔥", "✨", "🧠", "📚", "✏️", "💼", "🏠", "🌍",
  "⚽", "🏋️", "🍎", "💪", "🎨", "🎵", "🎮", "💻", "📱", "🔧", "🔑", "👥",
  "🙂", "🤔", "🎉", "🌱", "☀️", "⚡", "🧩", "🗂️", "🛠️", "🧭", "💬", "🔍",
];

const EDGE_PATHS: { value: EdgePath; label: string }[] = [
  { value: "straight", label: "Droit" },
  { value: "bezier", label: "Courbe" },
  { value: "step", label: "Angle" },
];

function startDrag(e: DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "copy";
}

function ShapeIcon({ shape }: { shape: Shape }) {
  const fill = "currentColor";
  return (
    <svg viewBox="0 0 40 28" className="h-7 w-10" aria-hidden="true">
      {shape === "circle" && <circle cx="20" cy="14" r="11" fill={fill} />}
      {shape === "rectangle" && <rect x="4" y="5" width="32" height="18" rx="1.5" fill={fill} />}
      {shape === "rounded" && <rect x="4" y="5" width="32" height="18" rx="7" fill={fill} />}
      {shape === "diamond" && <polygon points="20,2 37,14 20,26 3,14" fill={fill} />}
      {shape === "cloud" && (
        <path
          transform="translate(2 1) scale(0.3)"
          d="M30 72C14 72 6 62 9 51C1 46 3 31 15 30C14 17 28 9 40 15C45 5 62 3 70 13C78 5 96 8 98 22C111 23 118 36 111 47C118 57 110 71 96 70C92 77 80 79 72 73C64 79 50 79 44 73C40 75 34 74 30 72Z"
          fill={fill}
        />
      )}
      {shape === "postit" && (
        <>
          <rect x="9" y="3" width="22" height="22" rx="1" fill="#fcd34d" />
          <rect x="15" y="1.5" width="10" height="3.5" fill="#fff" opacity="0.7" />
        </>
      )}
    </svg>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-200 px-4 py-4 last:border-b-0 dark:border-slate-800">
      <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

function Swatches({
  colors,
  current,
  target,
  onPick,
}: {
  colors: string[];
  current?: string;
  target: "bg" | "text";
  onPick: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          draggable
          onDragStart={(e) => startDrag(e, { kind: "color", target, color: c })}
          onClick={() => onPick(c)}
          title={`${c} — clique pour appliquer, ou glisse sur un nœud`}
          aria-label={`Couleur ${c}`}
          className={`h-6 w-6 cursor-grab rounded-full border border-black/10 shadow-sm transition hover:scale-115 active:cursor-grabbing dark:border-white/15 ${
            current?.toLowerCase() === c ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-indigo-300 dark:ring-offset-slate-900" : ""
          }`}
          style={{ background: c }}
        />
      ))}
      <label
        title="Couleur libre"
        className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-black/10 shadow-sm dark:border-white/15"
        style={{ background: "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #ec4899, #ef4444)" }}
      >
        <input
          type="color"
          aria-label="Couleur libre"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={current && /^#[0-9a-f]{6}$/i.test(current) ? current : "#6366f1"}
          onChange={(e) => onPick(e.target.value)}
        />
      </label>
    </div>
  );
}

function Toggle({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm transition active:scale-95 ${
        active
          ? "border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:border-indigo-400 dark:text-indigo-200"
          : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export interface ToolboxProps {
  /** Données du premier nœud sélectionné (sert à refléter l'état courant). */
  selection: MindNodeData | null;
  selectedNodeCount: number;
  selectedEdgeCount: number;
  edgeStyle: MindEdgeData;
  onNodeStyle: (patch: Partial<MindNodeData>, historyKey?: string) => void;
  onEdgeStyle: (patch: Partial<MindEdgeData>) => void;
  onAddShape: (shape: Shape) => void;
  onNeedSelection: () => void;
}

export function Toolbox({
  selection,
  selectedNodeCount,
  selectedEdgeCount,
  edgeStyle,
  onNodeStyle,
  onEdgeStyle,
  onAddShape,
  onNeedSelection,
}: ToolboxProps) {
  const [customEmoji, setCustomEmoji] = useState("");
  const hasNodes = selectedNodeCount > 0;
  const styleNodes = (patch: Partial<MindNodeData>, key?: string) => (hasNodes ? onNodeStyle(patch, key) : onNeedSelection());

  const selectionLabel =
    selectedNodeCount === 1 && selection
      ? `« ${selection.label.slice(0, 28) || "…"} »`
      : selectedNodeCount > 1
        ? `${selectedNodeCount} nœuds sélectionnés`
        : selectedEdgeCount > 0
          ? `${selectedEdgeCount} lien${selectedEdgeCount > 1 ? "s" : ""} sélectionné${selectedEdgeCount > 1 ? "s" : ""}`
          : "Aucune sélection";

  return (
    <div className="mm-scroll h-full overflow-y-auto text-sm">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0f1320]/90">
        <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">Boîte à outils</div>
        <div className="mt-0.5 truncate font-medium text-slate-800 dark:text-slate-100">{selectionLabel}</div>
      </div>

      <Section title="Formes">
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map((shape) => (
            <button
              key={shape}
              type="button"
              draggable
              onDragStart={(e) => startDrag(e, { kind: "shape", shape })}
              onClick={() => (hasNodes ? onNodeStyle({ shape }) : onAddShape(shape))}
              title={hasNodes ? `Appliquer « ${SHAPE_LABELS[shape]} »` : `Ajouter un nœud « ${SHAPE_LABELS[shape]} » (ou glisse-le sur le canevas)`}
              className={`flex cursor-grab flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
                selection?.shape === shape
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
              }`}
            >
              <ShapeIcon shape={shape} />
              <span className="text-slate-700 dark:text-slate-300">{SHAPE_LABELS[shape]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Glisse un élément sur le canevas pour créer un nœud, ou sur un nœud pour le modifier.
        </p>
      </Section>

      <Section title="Couleur de fond">
        <Swatches
          colors={BG_PALETTE}
          current={selection?.bgColor}
          target="bg"
          onPick={(c) => styleNodes({ bgColor: c }, "bgColor")}
        />
      </Section>

      <Section title="Couleur du texte">
        <Swatches
          colors={TEXT_PALETTE}
          current={selection?.textColor}
          target="text"
          onPick={(c) => styleNodes({ textColor: c }, "textColor")}
        />
      </Section>

      <Section title="Emojis">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              draggable
              onDragStart={(e) => startDrag(e, { kind: "emoji", emoji })}
              onClick={() => styleNodes({ emoji })}
              className={`flex h-8 w-8 cursor-grab items-center justify-center rounded-lg text-lg transition hover:scale-125 hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-slate-800 ${
                selection?.emoji === emoji ? "bg-indigo-500/15" : ""
              }`}
              aria-label={`Emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={customEmoji}
            onChange={(e) => setCustomEmoji(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customEmoji.trim()) styleNodes({ emoji: customEmoji.trim() });
            }}
            placeholder="Autre emoji…"
            maxLength={8}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 outline-none focus:border-indigo-500 dark:border-slate-700"
          />
          <button
            type="button"
            onClick={() => styleNodes({ emoji: "" })}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Retirer
          </button>
        </div>
      </Section>

      <Section title="Texte">
        <div className="flex items-center gap-2">
          <Toggle active={!!selection?.bold} title="Gras" onClick={() => styleNodes({ bold: !selection?.bold })}>
            <span className="font-bold">G</span>
          </Toggle>
          <Toggle active={!!selection?.italic} title="Italique" onClick={() => styleNodes({ italic: !selection?.italic })}>
            <span className="font-serif italic">I</span>
          </Toggle>
          <div className="ml-auto flex items-center gap-1">
            <Toggle active={false} title="Réduire la taille" onClick={() => styleNodes({ fontSize: Math.max(10, (selection?.fontSize ?? 15) - 1) }, "fontSize")}>
              <span className="text-xs">A−</span>
            </Toggle>
            <span className="w-8 text-center tabular-nums text-slate-600 dark:text-slate-300">{selection?.fontSize ?? "–"}</span>
            <Toggle active={false} title="Agrandir la taille" onClick={() => styleNodes({ fontSize: Math.min(48, (selection?.fontSize ?? 15) + 1) }, "fontSize")}>
              <span>A+</span>
            </Toggle>
          </div>
        </div>
        <input
          type="range"
          min={10}
          max={48}
          aria-label="Taille du texte"
          value={selection?.fontSize ?? 15}
          disabled={!hasNodes}
          onChange={(e) => onNodeStyle({ fontSize: Number(e.target.value) }, "fontSize")}
          className="mt-3 w-full accent-indigo-500 disabled:opacity-40"
        />
      </Section>

      <Section title="Style des liens">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
          {EDGE_PATHS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onEdgeStyle({ path: p.value })}
              className={`rounded-lg py-1.5 text-xs font-medium transition ${
                edgeStyle.path === p.value
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Toggle active={edgeStyle.dashed} title="Trait pointillé" onClick={() => onEdgeStyle({ dashed: !edgeStyle.dashed })}>
            <svg width="34" height="10" aria-hidden="true">
              <line x1="2" y1="5" x2="32" y2="5" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 4" />
            </svg>
            <span className="ml-1.5 text-xs">Pointillé</span>
          </Toggle>
          <Toggle active={edgeStyle.arrow} title="Flèche au bout du lien" onClick={() => onEdgeStyle({ arrow: !edgeStyle.arrow })}>
            <svg width="30" height="10" aria-hidden="true">
              <line x1="2" y1="5" x2="22" y2="5" stroke="currentColor" strokeWidth="2.5" />
              <path d="M21 0 L29 5 L21 10 Z" fill="currentColor" />
            </svg>
            <span className="ml-1.5 text-xs">Flèche</span>
          </Toggle>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {selectedEdgeCount > 0
            ? "S'applique aux liens sélectionnés."
            : "S'applique à tous les liens et aux prochains liens créés."}
        </p>
      </Section>

      <Section title="Raccourcis">
        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          {[
            ["Double-clic", "modifier le texte"],
            ["Tab", "ajouter un enfant"],
            ["Entrée / F2", "modifier le nœud sélectionné"],
            ["Suppr", "supprimer la sélection"],
            ["Ctrl + Z / Ctrl + Y", "annuler / rétablir"],
            ["Clic droit", "développer avec Claude"],
            ["Maj + glisser", "sélection multiple"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-center gap-2">
              <KeyboardIcon size={13} className="shrink-0 opacity-60" />
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {k}
              </kbd>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
