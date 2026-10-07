import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, RefreshIcon, XIcon } from "./Icons";

type Kind = "success" | "error" | "info";
export interface ToastAction {
  label: string;
  onClick: () => void;
}
interface Toast {
  id: number;
  kind: Kind;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string, action?: ToastAction) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (kind: Kind, message: string, action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, kind, message, action }]);
      setTimeout(() => dismiss(id), kind === "error" ? (action ? 12000 : 8000) : action ? 6000 : 3500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, action) => push("success", m, action),
      error: (m, action) => push("error", m, action),
      info: (m) => push("info", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // --mm-bottom-ui : hauteur des barres flottantes du bas (éditeur sur téléphone).
        className="no-print pointer-events-none fixed left-1/2 z-[60] flex w-[min(calc(100vw-1.5rem),460px)] -translate-x-1/2 flex-col gap-2"
        style={{ bottom: "calc(1rem + var(--safe-bottom) + var(--mm-bottom-ui, 0px))" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex animate-slide-up items-center gap-2 rounded-xl border py-1.5 pr-1 pl-3.5 text-sm shadow-xl backdrop-blur ${
              t.kind === "error"
                ? "border-red-300 bg-red-50/95 text-red-800 dark:border-red-500/40 dark:bg-red-950/90 dark:text-red-100"
                : t.kind === "success"
                  ? "border-emerald-300 bg-emerald-50/95 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/90 dark:text-emerald-100"
                  : "border-slate-200 bg-white/95 text-slate-700 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
            }`}
          >
            <span className="shrink-0">{t.kind === "error" ? <AlertIcon size={17} /> : <CheckIcon size={16} />}</span>
            <span className="flex-1 py-1.5 leading-snug">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  dismiss(t.id);
                  t.action!.onClick();
                }}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition active:scale-95 tap:h-11 ${
                  t.kind === "error"
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-slate-900/10 text-current hover:bg-slate-900/15 dark:bg-white/15 dark:hover:bg-white/20"
                }`}
              >
                {t.kind === "error" && <RefreshIcon size={14} strokeWidth={2.5} />}
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg opacity-60 transition hover:opacity-100 tap:h-11 tap:w-11"
              aria-label="Fermer"
            >
              <XIcon size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx;
}
