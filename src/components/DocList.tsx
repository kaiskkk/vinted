import { useState } from "react";
import { ShareButton } from "./ShareButton";
import { openItem } from "../hooks/useHashRoute";
import { deleteDoc, loadDoc, renameDoc, saveDoc } from "../lib/docs";
import { formatDate } from "../lib/format";
import type { LibraryItem } from "../lib/library";
import { deleteMap, loadMap, renameMap, saveMap } from "../lib/storage";
import { PencilIcon, TrashIcon } from "./Icons";
import { KIND_LOOK, KindBadge } from "./looks";
import { Modal, btn } from "./Modal";
import { useToast } from "./Toasts";
import { card } from "./ui";

const actionsVisible = "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 pointer-coarse:opacity-100";

/** Liste de documents (et de cartes) avec ouverture, renommage et suppression annulable. */
export function DocList({ items, onChange, showType = true }: { items: LibraryItem[]; onChange: () => void; showType?: boolean }) {
  const toast = useToast();
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [toDelete, setToDelete] = useState<LibraryItem | null>(null);

  const commitRename = () => {
    if (!renaming) return;
    const item = items.find((i) => i.id === renaming.id);
    const value = renaming.value.trim();
    if (item && value && value !== item.titre) {
      if (item.kind === "carte") renameMap(item.id, value);
      else renameDoc(item.id, value);
    }
    setRenaming(null);
    onChange();
  };

  const confirmDelete = () => {
    const item = toDelete;
    if (!item) return;
    setToDelete(null);
    if (item.kind === "carte") {
      const backup = loadMap(item.id);
      deleteMap(item.id);
      toast.success(`Carte supprimée : « ${item.titre} ».`, backup ? { label: "Annuler", onClick: () => (saveMap(backup), onChange()) } : undefined);
    } else {
      const backup = loadDoc(item.id);
      deleteDoc(item.id);
      toast.success(
        `Document supprimé : « ${item.titre} ».`,
        backup ? { label: "Annuler", onClick: () => (saveDoc(backup), onChange()) } : undefined,
      );
    }
    onChange();
  };

  return (
    <>
      <ul className={`${card} divide-y divide-slate-100 overflow-hidden dark:divide-slate-800`}>
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="group flex items-center gap-1 pr-1.5">
            {renaming?.id === item.id ? (
              <div className="flex min-h-16 flex-1 items-center gap-3 px-3 sm:px-4">
                <KindBadge kind={item.kind} />
                <input
                  autoFocus
                  value={renaming.value}
                  onChange={(e) => setRenaming({ id: item.id, value: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  maxLength={140}
                  enterKeyHint="done"
                  aria-label="Nouveau nom"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-indigo-400 bg-transparent px-2 text-base font-semibold outline-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openItem(item.kind, item.id)}
                className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100 sm:px-4 dark:hover:bg-slate-800/60 dark:active:bg-slate-800"
              >
                <KindBadge kind={item.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{item.titre}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {showType && `${KIND_LOOK[item.kind].label} · `}
                    {item.info} · {formatDate(item.updatedAt)}
                  </span>
                </span>
              </button>
            )}
            {renaming?.id !== item.id && (
              <div className={`flex shrink-0 transition ${actionsVisible}`}>
                <ShareButton compact kind={item.kind} id={item.id} titre={item.titre} />
                <button
                  type="button"
                  className={btn.icon}
                  title="Renommer"
                  aria-label={`Renommer ${item.titre}`}
                  onClick={() => setRenaming({ id: item.id, value: item.titre })}
                >
                  <PencilIcon size={16} />
                </button>
                <button
                  type="button"
                  className={`${btn.icon} hover:text-red-600 dark:hover:text-red-400`}
                  title="Supprimer"
                  aria-label={`Supprimer ${item.titre}`}
                  onClick={() => setToDelete(item)}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {toDelete && (
        <Modal
          title="Supprimer ce document ?"
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
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {KIND_LOOK[toDelete.kind].label} : « {toDelete.titre} ». Ce document sera supprimé de cet appareil.
          </p>
        </Modal>
      )}
    </>
  );
}
