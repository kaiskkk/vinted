import { useEffect, useState } from "react";
import { setAccessCodePrompt } from "../lib/api";
import { Modal, btn } from "./Modal";

/** Demande le code d'accès quand le site en ligne est protégé (variable CODE_ACCES). */
export function AccessCodePrompt() {
  const [request, setRequest] = useState<{ wrong: boolean; resolve: (code: string | null) => void } | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    setAccessCodePrompt(
      (wrong) =>
        new Promise((resolve) => {
          setValue("");
          setRequest({ wrong, resolve });
        }),
    );
    return () => setAccessCodePrompt(null);
  }, []);

  if (!request) return null;

  const finish = (code: string | null) => {
    request.resolve(code);
    setRequest(null);
  };
  const submit = () => value.trim() && finish(value);

  return (
    <Modal
      title="Code d'accès"
      onClose={() => finish(null)}
      footer={
        <>
          <button className={btn.secondary} onClick={() => finish(null)}>
            Annuler
          </button>
          <button className={btn.primary} onClick={submit} disabled={!value.trim()}>
            Valider
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {request.wrong
          ? "Ce code est incorrect. Réessaie."
          : "Ce site est protégé pour que personne d'autre n'utilise ta clé API. Entre le code d'accès choisi lors de la mise en ligne."}
      </p>
      <input
        autoFocus
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        aria-label="Code d'accès"
        className="mt-4 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-base text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:text-white"
      />
      <p className="mt-2 text-xs text-slate-500">Il sera mémorisé dans ce navigateur.</p>
    </Modal>
  );
}
