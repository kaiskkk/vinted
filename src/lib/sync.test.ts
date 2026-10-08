import { beforeEach, describe, expect, it, vi } from "vitest";

// localStorage minimal en mémoire (les tests tournent sous Node).
class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}
globalThis.localStorage ??= new MemoryStorage() as unknown as Storage;

const { CloudSync, OWNER_KEY, clearLocalData, isSyncedKey, localDataSummary, mergeValue } = await import("./sync");
const { blankFiche, listDocs, loadDoc, saveDoc } = await import("./docs");
const { readSerie } = await import("./serie");
import type { CloudBackend, RemoteEntry } from "./sync";

/** Compte en ligne simulé : chaque écriture reçoit une heure de serveur croissante. */
function fakeCloud() {
  const docs = new Map<string, { v: string | null; t: number }>();
  let clock = 0;
  const backend: CloudBackend & { pushes: number } = {
    pushes: 0,
    async pull(since) {
      const entries = new Map<string, RemoteEntry>();
      let cursor = since;
      for (const [k, d] of docs) {
        if (d.t <= since) continue;
        entries.set(k, { v: d.v });
        cursor = Math.max(cursor, d.t);
      }
      return { entries, cursor };
    },
    async push(sets, deletes) {
      backend.pushes++;
      for (const { key, v } of sets) docs.set(key, { v, t: ++clock });
      for (const key of deletes) docs.set(key, { v: null, t: ++clock });
    },
  };
  /** Écriture faite depuis un autre appareil. */
  const remoteWrite = (key: string, v: string | null) => docs.set(key, { v, t: ++clock });
  return { backend, docs, remoteWrite };
}

describe("synchronisation avec le compte", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("ne synchronise que les données de l'élève", () => {
    expect(isSyncedKey("mm-map:abc")).toBe(true);
    expect(isSyncedKey("ed-doc:abc")).toBe(true);
    expect(isSyncedKey("ed-classeur:abc")).toBe(true);
    expect(isSyncedKey("ed-serie")).toBe(true);
    expect(isSyncedKey("ed-niveau")).toBe(true);
    // Index reconstruits, réglages de l'appareil et code d'accès restent locaux.
    for (const k of ["mm-index", "ed-docs", "ed-classeurs", "mm-theme-choice", "mm-code-acces", "sync-attente", "mm-map:"])
      expect(isSyncedKey(k)).toBe(false);
  });

  it("envoie chaque écriture, et les suppressions", async () => {
    const { backend, docs } = fakeCloud();
    const sync = new CloudSync(backend, "u1");
    sync.start();
    const fiche = blankFiche("Les volcans");
    saveDoc(fiche);
    localStorage.setItem("mm-theme-choice", "dark");
    expect(sync.pendingCount()).toBe(1);
    await sync.flush();
    expect(sync.pendingCount()).toBe(0);
    expect(JSON.parse(docs.get(`ed-doc:${fiche.id}`)!.v!).titre).toBe("Les volcans");
    expect(docs.has("ed-docs")).toBe(false);
    expect(docs.has("mm-theme-choice")).toBe(false);

    localStorage.removeItem(`ed-doc:${fiche.id}`);
    await sync.flush();
    expect(docs.get(`ed-doc:${fiche.id}`)!.v).toBeNull();
    expect(sync.getStatus()).toMatchObject({ state: "idle", pending: 0 });
    sync.stop();
  });

  it("garde dans la file une donnée modifiée pendant l'envoi", async () => {
    const { backend, docs } = fakeCloud();
    const push = backend.push;
    let first = true;
    backend.push = async (sets, deletes) => {
      if (first) {
        first = false;
        localStorage.setItem("ed-niveau", "superieur"); // modifié pendant l'envoi
      }
      return push(sets, deletes);
    };
    const sync = new CloudSync(backend, "u1");
    sync.start();
    localStorage.setItem("ed-niveau", "college");
    await sync.flush();
    expect(docs.get("ed-niveau")!.v).toBe("superieur");
    expect(sync.pendingCount()).toBe(0);
    sync.stop();
  });

  it("récupère les modifications des autres appareils et reconstruit les listes", async () => {
    const { backend, remoteWrite } = fakeCloud();
    const onChange = vi.fn();
    const sync = new CloudSync(backend, "u1", onChange);
    sync.start();
    const ailleurs = blankFiche("Faite sur le téléphone");
    remoteWrite(`ed-doc:${ailleurs.id}`, JSON.stringify(ailleurs));
    expect(await sync.pull()).toBe(true);
    expect(loadDoc(ailleurs.id)?.titre).toBe("Faite sur le téléphone");
    expect(listDocs().map((d) => d.id)).toEqual([ailleurs.id]);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Suppression sur l'autre appareil.
    remoteWrite(`ed-doc:${ailleurs.id}`, null);
    expect(await sync.pull()).toBe(true);
    expect(loadDoc(ailleurs.id)).toBeNull();
    expect(listDocs()).toEqual([]);

    // Rien de neuf : rien ne change.
    expect(await sync.pull()).toBe(false);
    sync.stop();
  });

  it("une modification locale pas encore envoyée l'emporte", async () => {
    const { backend, remoteWrite, docs } = fakeCloud();
    const sync = new CloudSync(backend, "u1");
    sync.start();
    localStorage.setItem("ed-niveau", "college");
    remoteWrite("ed-niveau", "lycee");
    await sync.pull();
    await sync.flush();
    expect(localStorage.getItem("ed-niveau")).toBe("college");
    expect(docs.get("ed-niveau")!.v).toBe("college");
    sync.stop();
  });

  it("une récupération complète renvoie ce qui n'existe que sur l'appareil", async () => {
    const { backend, docs } = fakeCloud();
    localStorage.setItem(OWNER_KEY, "u1");
    localStorage.setItem("ed-niveau", "college"); // écrit hors synchronisation
    const sync = new CloudSync(backend, "u1");
    sync.start();
    await sync.pull();
    await sync.flush();
    expect(docs.get("ed-niveau")!.v).toBe("college");
    sync.stop();
  });

  it("importe les données de l'appareil à la première connexion, en fusionnant", async () => {
    const { backend, remoteWrite, docs } = fakeCloud();
    // Sur l'appareil, avant la connexion :
    const locale = blankFiche("Fiche locale");
    saveDoc(locale);
    const commune = { ...blankFiche("Version récente"), updatedAt: 2000 };
    saveDoc(commune);
    localStorage.setItem("ed-serie", JSON.stringify({ jours: { "2026-10-01": { quiz: 1 } } }));
    expect(localDataSummary()).toMatchObject({ documents: 2, jours: 1, any: true });
    // Dans le compte :
    const enLigne = blankFiche("Fiche du compte");
    remoteWrite(`ed-doc:${enLigne.id}`, JSON.stringify(enLigne));
    remoteWrite(`ed-doc:${commune.id}`, JSON.stringify({ ...commune, titre: "Version ancienne", updatedAt: 1000 }));
    remoteWrite("ed-serie", JSON.stringify({ jours: { "2026-10-02": { flashcards: 3 } } }));

    const sync = new CloudSync(backend, "u1");
    await sync.importLocal();
    sync.start();
    await sync.flush();

    expect(localStorage.getItem(OWNER_KEY)).toBe("u1");
    expect(
      listDocs()
        .map((d) => d.titre)
        .sort(),
    ).toEqual(["Fiche du compte", "Fiche locale", "Version récente"]);
    expect(Object.keys(readSerie().jours).sort()).toEqual(["2026-10-01", "2026-10-02"]);
    expect(JSON.parse(docs.get(`ed-doc:${commune.id}`)!.v!).titre).toBe("Version récente");
    expect(JSON.parse(docs.get(`ed-doc:${locale.id}`)!.v!).titre).toBe("Fiche locale");
    expect(Object.keys(JSON.parse(docs.get("ed-serie")!.v!).jours)).toHaveLength(2);
    sync.stop();
  });

  it("efface les données de l'appareil sans toucher aux réglages", () => {
    saveDoc(blankFiche("x"));
    localStorage.setItem("mm-theme-choice", "dark");
    localStorage.setItem(OWNER_KEY, "u1");
    clearLocalData();
    expect(listDocs()).toEqual([]);
    expect(localStorage.getItem("ed-docs")).toBeNull();
    expect(localStorage.getItem(OWNER_KEY)).toBeNull();
    expect(localStorage.getItem("mm-theme-choice")).toBe("dark");
    expect(localDataSummary().any).toBe(false);
  });

  it("fusionne les valeurs selon leur nature", () => {
    expect(mergeValue("ed-niveau", "college", "lycee")).toBe("college");
    expect(JSON.parse(mergeValue("ed-liens-cartes", '{"a":"1"}', '{"b":"2"}'))).toEqual({ a: "1", b: "2" });
    expect(mergeValue("ed-doc:x", '{"updatedAt":5}', '{"updatedAt":9}')).toBe('{"updatedAt":9}');
    expect(mergeValue("ed-doc:x", '{"updatedAt":10}', '{"updatedAt":9}')).toBe('{"updatedAt":10}');
  });

  it("réessaie plus tard après un échec, sans rien perdre", async () => {
    const { backend } = fakeCloud();
    backend.push = async () => {
      throw Object.assign(new Error("refusé"), { code: "permission-denied" });
    };
    const sync = new CloudSync(backend, "u1");
    sync.start();
    localStorage.setItem("ed-niveau", "college");
    await sync.flush();
    expect(sync.getStatus().state).toBe("error");
    expect(sync.getStatus().message).toMatch(/règles de Firestore/);
    expect(sync.pendingCount()).toBe(1);
    expect(JSON.parse(localStorage.getItem("sync-attente")!)).toEqual(["ed-niveau"]);
    sync.stop();
    // La file survit au rechargement de la page.
    expect(new CloudSync(backend, "u1").pendingCount()).toBe(1);
  });
});
