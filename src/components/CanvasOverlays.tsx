import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon, FitIcon, LayoutIcon, MinusIcon, MoreIcon, PaletteIcon, PencilIcon, PlusIcon } from "./Icons";

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95 tap:h-11 tap:w-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {children}
    </button>
  );
}

/** Zoom, « Recentrer la carte » et « Organiser automatiquement ». */
export function MapControls({
  vertical,
  showZoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onLayout,
}: {
  vertical: boolean;
  showZoom: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onLayout: () => void;
}) {
  return (
    <div
      className={`flex overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/85 ${
        vertical ? "flex-col divide-y" : "flex-row divide-x"
      } divide-slate-200 dark:divide-slate-700/80`}
    >
      {showZoom && (
        <>
          <RoundButton label="Zoom avant" onClick={onZoomIn}>
            <PlusIcon />
          </RoundButton>
          <RoundButton label="Zoom arrière" onClick={onZoomOut}>
            <MinusIcon />
          </RoundButton>
        </>
      )}
      <RoundButton label="Recentrer la carte" onClick={onFit}>
        <FitIcon />
      </RoundButton>
      <RoundButton label="Organiser automatiquement" onClick={onLayout}>
        <LayoutIcon />
      </RoundButton>
    </div>
  );
}

function BarButton({ label, onClick, children, accent }: { label: string; onClick: () => void; children: ReactNode; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 min-w-15 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-medium transition active:scale-95 ${
        accent
          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 active:bg-indigo-500"
          : "text-slate-700 active:bg-slate-100 dark:text-slate-200 dark:active:bg-slate-800"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

/** Téléphone : grandes actions sur le nœud sélectionné. */
export function SelectionBar({
  onAddChild,
  onEdit,
  onStyle,
  onMore,
}: {
  onAddChild: () => void;
  onEdit: () => void;
  onStyle: () => void;
  onMore: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Actions sur le nœud sélectionné"
      className="flex animate-slide-up gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-xl shadow-slate-900/15 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90"
    >
      <BarButton label="Enfant" onClick={onAddChild} accent>
        <PlusIcon size={20} strokeWidth={2.5} />
      </BarButton>
      <BarButton label="Texte" onClick={onEdit}>
        <PencilIcon size={19} />
      </BarButton>
      <BarButton label="Style" onClick={onStyle}>
        <PaletteIcon size={19} />
      </BarButton>
      <BarButton label="Plus" onClick={onMore}>
        <MoreIcon size={19} />
      </BarButton>
    </div>
  );
}

/** Bouton flottant qui ouvre la boîte à outils sur téléphone. */
export function ToolboxFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ouvrir la boîte à outils"
      title="Boîte à outils"
      className="flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-600/40 transition active:scale-95"
    >
      <PaletteIcon size={24} />
    </button>
  );
}

/** Notification discrète après chaque sauvegarde automatique. */
export function SavedIndicator({ at, className = "" }: { at: number | null; className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!at) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1600);
    return () => clearTimeout(t);
  }, [at]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-opacity duration-300 dark:bg-emerald-400/12 dark:text-emerald-300 ${
        visible ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      <CheckIcon size={13} strokeWidth={2.5} />
      Sauvegardé
    </div>
  );
}
