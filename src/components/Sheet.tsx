import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { XIcon } from "./Icons";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Voile sombre derrière le panneau (menus). Sans voile, le canevas reste utilisable. */
  backdrop?: boolean;
  /** Hauteur maximale, par exemple "62dvh". */
  maxHeight?: string;
  label: string;
}

/**
 * Panneau qui monte depuis le bas de l'écran (téléphone).
 * Se ferme avec le bouton ×, en glissant la poignée vers le bas, avec Échap,
 * ou en touchant le voile quand il y en a un.
 */
export function BottomSheet({ open, onClose, title, children, backdrop = false, maxHeight = "62dvh", label }: BottomSheetProps) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const openedAt = useRef(0);

  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    setDrag(0);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const style: CSSProperties = {
    maxHeight,
    transform: drag ? `translateY(${drag}px)` : undefined,
    transition: start.current === null ? "transform 0.2s ease-out" : "none",
  };

  return (
    <>
      {backdrop && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-slate-950/40"
          // L'appui long qui ouvre un menu se termine sur ce voile : on ignore ce premier relâchement.
          onClick={() => Date.now() - openedAt.current > 400 && onClose()}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-modal={backdrop}
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-2xl animate-sheet-up flex-col rounded-t-3xl border border-b-0 border-slate-200 bg-white/97 pr-[var(--safe-right)] pl-[var(--safe-left)] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-slate-800 dark:bg-[#11162a]/97"
        style={style}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none items-center gap-2 px-4 pt-2 pb-1 select-none"
          onPointerDown={(e) => {
            start.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current));
          }}
          onPointerUp={() => {
            const dy = drag;
            start.current = null;
            if (dy > 70) onClose();
            else setDrag(0);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDrag(0);
          }}
        >
          <div className="flex-1">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
            <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <XIcon />
          </button>
        </div>
        <div className="mm-scroll min-h-0 flex-1 overflow-y-auto pb-[calc(0.5rem+var(--safe-bottom))]">{children}</div>
      </div>
    </>
  );
}

export interface SheetAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
}

/** Menu d'actions tactile : grandes lignes faciles à toucher, dans un panneau du bas. */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
  header,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  actions: SheetAction[];
  header?: ReactNode;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} backdrop maxHeight="80dvh" label="Menu d'actions">
      {header}
      <ul className="px-2 pt-1">
        {actions.map((a) => (
          <li key={a.label}>
            <button
              type="button"
              disabled={a.disabled}
              onClick={() => {
                onClose();
                a.onSelect();
              }}
              className={`flex min-h-13 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] transition active:scale-[0.99] disabled:opacity-40 ${
                a.danger
                  ? "text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-950/40"
                  : a.accent
                    ? "font-medium text-indigo-700 active:bg-indigo-50 dark:text-indigo-300 dark:active:bg-indigo-950/50"
                    : "text-slate-800 active:bg-slate-100 dark:text-slate-100 dark:active:bg-slate-800"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">{a.icon}</span>
              {a.label}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
