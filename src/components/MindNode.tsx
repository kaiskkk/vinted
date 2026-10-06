import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { LABEL_MAX_WIDTH, POSTIT_MIN, shapePadding } from "../lib/nodeSize";
import type { MindNode, Shape } from "../types";
import { useEditor } from "./editorContext";
import { PlusIcon, Spinner } from "./Icons";

const SIDES = [
  { id: "t", position: Position.Top },
  { id: "r", position: Position.Right },
  { id: "b", position: Position.Bottom },
  { id: "l", position: Position.Left },
];

const SHAPE_CLASS: Record<Shape, string> = {
  rectangle: "rounded-md shadow-md",
  rounded: "rounded-2xl shadow-md",
  circle: "rounded-full aspect-square shadow-md",
  postit: "rounded-[3px] text-left items-start justify-start shadow-[0_10px_18px_-8px_rgba(0,0,0,0.45)]",
  diamond: "",
  cloud: "",
};

const CLOUD_PATH =
  "M30 72C14 72 6 62 9 51C1 46 3 31 15 30C14 17 28 9 40 15C45 5 62 3 70 13C78 5 96 8 98 22C111 23 118 36 111 47C118 57 110 71 96 70C92 77 80 79 72 73C64 79 50 79 44 73C40 75 34 74 30 72Z";

/** Fond vectoriel pour les formes non rectangulaires (losange, nuage). */
function ShapeBackground({ shape, color, selected }: { shape: "diamond" | "cloud"; color: string; selected: boolean }) {
  const stroke = selected ? "var(--mm-edge-selected)" : "rgb(0 0 0 / 0.12)";
  const common = {
    fill: color,
    stroke,
    strokeWidth: selected ? 2.5 : 1,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]"
      viewBox={shape === "diamond" ? "0 0 100 100" : "0 0 120 80"}
      preserveAspectRatio="none"
    >
      {shape === "diamond" ? <polygon points="50,1 99,50 50,99 1,50" {...common} /> : <path d={CLOUD_PATH} {...common} />}
    </svg>
  );
}

function LabelEditor({
  initial,
  width,
  style,
  onDone,
}: {
  initial: string;
  width: number;
  style: CSSProperties;
  onDone: (value: string | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const [value, setValue] = useState(initial);

  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    const el = ref.current!;
    autosize(el);
    // React Flow masque un nouveau nœud tant qu'il n'est pas mesuré : on réessaie
    // de prendre le focus image par image jusqu'à ce qu'il soit visible.
    let raf = 0;
    let frames = 0;
    const tryFocus = () => {
      el.focus({ preventScroll: true });
      if (document.activeElement === el) el.select();
      else if (frames++ < 30) raf = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, []);

  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };

  return (
    <textarea
      ref={ref}
      aria-label="Texte du nœud"
      className="nodrag nopan nowheel block resize-none overflow-hidden bg-transparent text-center leading-[1.3] outline-none placeholder:opacity-50"
      style={{ ...style, width, minWidth: 80, maxWidth: LABEL_MAX_WIDTH + 40 }}
      rows={1}
      value={value}
      placeholder="Écris ton idée…"
      onChange={(e) => {
        setValue(e.target.value);
        autosize(e.target);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={() => finish(value)}
    />
  );
}

function MindNodeView({ id, data, selected, positionAbsoluteX }: NodeProps<MindNode>) {
  const { addChild, commitLabel, editingId, setEditingId, rootCenterX } = useEditor();
  const editing = editingId === id;
  const labelRef = useRef<HTMLSpanElement>(null);
  const lastLabelWidth = useRef(120);

  useLayoutEffect(() => {
    if (!editing && labelRef.current) lastLabelWidth.current = labelRef.current.offsetWidth;
  });

  const svgShape = data.shape === "diamond" || data.shape === "cloud";
  const pad = shapePadding(data.shape, data.fontSize);
  const onLeft = !data.isRoot && positionAbsoluteX < rootCenterX;

  const textStyle: CSSProperties = {
    color: data.textColor,
    fontSize: data.fontSize,
    fontWeight: data.bold ? 700 : 500,
    fontStyle: data.italic ? "italic" : "normal",
  };

  const boxStyle: CSSProperties = {
    padding: `${pad.y}px ${pad.x}px`,
    ...(svgShape ? {} : { background: data.bgColor }),
    ...(data.shape === "postit" ? { minWidth: POSTIT_MIN.width, minHeight: POSTIT_MIN.height } : {}),
  };

  const selectedOutline = selected && !svgShape ? "outline-2 outline-offset-[3px] outline-indigo-500 dark:outline-indigo-300" : "";

  return (
    <div
      className={`group relative flex animate-pop items-center justify-center text-center transition-shadow ${SHAPE_CLASS[data.shape]} ${selectedOutline} ${
        data.loading ? "animate-pulse" : ""
      }`}
      style={{ ...boxStyle, outlineStyle: selected && !svgShape ? "solid" : undefined }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingId(id);
      }}
    >
      {svgShape && <ShapeBackground shape={data.shape as "diamond" | "cloud"} color={data.bgColor} selected={!!selected} />}
      {data.shape === "postit" && (
        <span
          className="pointer-events-none absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 -rotate-3 rounded-[2px] bg-white/45 shadow-sm"
          aria-hidden="true"
        />
      )}

      {SIDES.map((s) => (
        <Handle key={s.id} id={s.id} type="source" position={s.position} className="mm-handle" />
      ))}

      <div className="relative leading-[1.3]" style={textStyle}>
        {editing ? (
          <LabelEditor
            initial={data.label}
            width={Math.max(120, lastLabelWidth.current + 16)}
            style={{ ...textStyle, textAlign: data.shape === "postit" ? "left" : "center" }}
            onDone={(value) => (value === null ? setEditingId(null) : commitLabel(id, value))}
          />
        ) : (
          <span
            ref={labelRef}
            className="block whitespace-pre-wrap break-words select-none"
            style={{ maxWidth: LABEL_MAX_WIDTH }}
          >
            {data.emoji && <span className="mr-1.5 inline-block not-italic">{data.emoji}</span>}
            {data.label || <span className="opacity-50">…</span>}
          </span>
        )}
      </div>

      <button
        type="button"
        data-export="ignore"
        title="Ajouter une idée enfant (Tab)"
        aria-label="Ajouter un enfant"
        className={`nodrag absolute top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-white shadow-md transition hover:scale-110 hover:bg-indigo-400 dark:border-[#0b0e17] ${
          selected
            ? // Sélectionné : toujours visible, plus gros au doigt.
              `scale-100 opacity-100 pointer-coarse:h-9 pointer-coarse:w-9 ${onLeft ? "-left-3 pointer-coarse:-left-5" : "-right-3 pointer-coarse:-right-5"}`
            : // Sinon : visible au survol de la souris seulement (pas de survol fiable au doigt).
              `scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 pointer-coarse:hidden ${onLeft ? "-left-3" : "-right-3"}`
        }`}
        // Ne prend pas le focus : la touche Entrée ne doit pas « recliquer » ce bouton.
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          addChild(id);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <PlusIcon size={selected ? 16 : 14} strokeWidth={3} />
      </button>

      {data.loading && (
        <span
          data-export="ignore"
          className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-indigo-600 shadow-lg dark:bg-slate-900 dark:text-indigo-300"
        >
          <Spinner />
        </span>
      )}
    </div>
  );
}

export const MindNodeComponent = memo(MindNodeView);
