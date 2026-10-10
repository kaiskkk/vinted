// Synchronisation des données de l'élève avec son compte (Firebase).
// Le site continue de lire et d'écrire dans le localStorage, comme avant les comptes : chaque écriture
// d'une donnée (carte, document, classeur, série, niveau) est repérée et envoyée en ligne peu après.
// Les index (listes) ne sont pas envoyés : ils sont reconstruits après chaque récupération.
import { mergeAgenda } from "./agenda";
import { rebuildDocIndexes } from "./docs";
import { mergeSerie, parseSerie } from "./serie";
import { rebuildMapIndex } from "./storage";

const SINGLETONS = ["ed-liens-cartes", "ed-niveau", "ed-serie", "ed-agenda", "ed-prenom"];
const INDEX_KEYS = ["mm-index", "ed-docs", "ed-classeurs"];
// ed-groupe : les classes dont l'élève fait partie (mode classe).
const CONTENT = /^(mm-map|ed-doc|ed-classeur|ed-groupe):./;

/** Clés propres à cet appareil, jamais envoyées. */
export const OWNER_KEY = "sync-proprietaire";
const PENDING_KEY = "sync-attente";
const CURSOR_KEY = "sync-curseur";

export const isSyncedKey = (key: string) => CONTENT.test(key) || SINGLETONS.includes(key);

/** Taille maximale d'un document Firestore (1 Mio), avec une marge. */
const MAX_BYTES = 900_000;
/** Lots d'écriture : 500 opérations et 10 Mo au plus par requête. */
const BATCH_OPS = 400;
const BATCH_BYTES = 4_000_000;
const FLUSH_DELAY_MS = 3000;
const PULL_EVERY_MS = 30_000;

export interface RemoteEntry {
  /** Valeur enregistrée, ou null si l'élément a été supprimé. */
  v: string | null;
}

export interface CloudBackend {
  /** Éléments modifiés depuis `since` (0 : tout) et le curseur à repasser la fois suivante. */
  pull(since: number): Promise<{ entries: Map<string, RemoteEntry>; cursor: number }>;
  push(sets: { key: string; v: string }[], deletes: string[]): Promise<void>;
}

export type SyncState = "idle" | "syncing" | "offline" | "error";
export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSync: number | null;
  message?: string;
}

// ---------- Accès direct au stockage (sans repérage) ----------

const storage = () => globalThis.localStorage;
const proto = () => Object.getPrototypeOf(storage()) as Storage;
let rawSet: (key: string, value: string) => void = (k, v) => storage().setItem(k, v);
let rawRemove: (key: string) => void = (k) => storage().removeItem(k);
const rawGet = (key: string) => storage().getItem(key);

export function localSyncedKeys(): string[] {
  const keys: string[] = [];
  const s = storage();
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && isSyncedKey(k)) keys.push(k);
  }
  return keys;
}

/** L'appareil contient-il des données créées par l'élève (avant de se connecter) ? */
export function localDataSummary() {
  const keys = localSyncedKeys();
  const count = (p: string) => keys.filter((k) => k.startsWith(p)).length;
  const jours = Object.keys(parseSerie(rawGet("ed-serie")).jours).length;
  const summary = { cartes: count("mm-map:"), documents: count("ed-doc:"), classeurs: count("ed-classeur:"), jours };
  return { ...summary, any: summary.cartes + summary.documents + summary.classeurs + summary.jours > 0 };
}

export const localOwner = () => rawGet(OWNER_KEY);

/** Retire de l'appareil toutes les données de l'élève (déconnexion, ou données non importées). */
export function clearLocalData() {
  for (const k of [...localSyncedKeys(), ...INDEX_KEYS, OWNER_KEY, PENDING_KEY, CURSOR_KEY]) rawRemove(k);
}

export function rebuildIndexes() {
  try {
    rebuildMapIndex();
    rebuildDocIndexes();
  } catch {
    // Stockage plein : les listes seront reconstruites à la prochaine synchronisation.
  }
}

const updatedAtOf = (v: string | null) => {
  try {
    const t = (JSON.parse(v ?? "null") as { updatedAt?: unknown } | null)?.updatedAt;
    return typeof t === "number" ? t : 0;
  } catch {
    return 0;
  }
};

/** Fusion d'une donnée présente à la fois sur l'appareil et dans le compte (import à la première connexion). */
export function mergeValue(key: string, local: string, remote: string): string {
  if (key === "ed-serie") return JSON.stringify(mergeSerie(parseSerie(remote), parseSerie(local)));
  if (key === "ed-liens-cartes") {
    try {
      return JSON.stringify({ ...JSON.parse(remote), ...JSON.parse(local) });
    } catch {
      return local;
    }
  }
  if (key === "ed-niveau" || key === "ed-prenom") return local;
  if (key === "ed-agenda") return mergeAgenda(remote, local);
  return updatedAtOf(local) > updatedAtOf(remote) ? local : remote;
}

const byteLength = (s: string) => new TextEncoder().encode(s).length;

// ---------- Moteur ----------

/** Le moteur actif (un seul à la fois : celui du compte connecté). */
let current: CloudSync | null = null;
let patched = false;

function installTracking() {
  if (patched) return;
  patched = true;
  const p = proto();
  const set = p.setItem;
  const remove = p.removeItem;
  rawSet = (k, v) => set.call(storage(), k, v);
  rawRemove = (k) => remove.call(storage(), k);
  p.setItem = function (this: Storage, key: string, value: string) {
    set.call(this, key, value);
    if (this === storage() && isSyncedKey(String(key))) current?.markPending(String(key));
  };
  p.removeItem = function (this: Storage, key: string) {
    remove.call(this, key);
    if (this === storage() && isSyncedKey(String(key))) current?.markPending(String(key));
  };
}

export class CloudSync {
  private pending = new Map<string, number>();
  private version = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 5000;
  private flushing: Promise<void> | null = null;
  private pulling: Promise<boolean> | null = null;
  private lastPull = 0;
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus = { state: "idle", pending: 0, lastSync: null };
  private cleanup: (() => void)[] = [];
  private stopped = false;

  constructor(
    private backend: CloudBackend,
    readonly uid: string,
    private onRemoteChange: () => void = () => {},
  ) {
    try {
      const saved = JSON.parse(rawGet(PENDING_KEY) ?? "[]");
      if (Array.isArray(saved)) for (const k of saved) if (typeof k === "string" && isSyncedKey(k)) this.pending.set(k, ++this.version);
    } catch {
      // File d'attente illisible : la prochaine récupération complète renverra ce qui manque.
    }
  }

  // ----- État affiché -----

  getStatus = () => this.status;

  onStatus(fn: (s: SyncStatus) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch, pending: this.pending.size };
    this.listeners.forEach((l) => l(this.status));
  }

  private savePending() {
    try {
      rawSet(PENDING_KEY, JSON.stringify([...this.pending.keys()]));
    } catch {
      // Stockage plein : les clés seront retrouvées par la récupération complète suivante.
    }
  }

  // ----- Envoi -----

  markPending(key: string) {
    if (this.stopped) return;
    this.pending.set(key, ++this.version);
    this.savePending();
    this.setStatus({});
    // Pas de remise à zéro du minuteur : pendant la frappe, un envoi part quand même toutes les 3 s au plus.
    if (!this.timer) this.schedule(FLUSH_DELAY_MS);
  }

  private schedule(delay: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  /** Envoie tout ce qui attend ; renvoie quand c'est fini (ou en échec). */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing.then(() => (this.pending.size && !this.stopped ? this.flush() : undefined));
    if (!this.pending.size || this.stopped) return Promise.resolve();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus({ state: "offline" });
      return Promise.resolve();
    }
    this.flushing = this.flushOnce().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async flushOnce() {
    this.setStatus({ state: "syncing" });
    try {
      while (this.pending.size && !this.stopped) {
        const sets: { key: string; v: string }[] = [];
        const deletes: string[] = [];
        const sent = new Map<string, number>();
        let bytes = 0;
        for (const [key, version] of this.pending) {
          if (sent.size >= BATCH_OPS) break;
          const v = rawGet(key);
          if (v === null) deletes.push(key);
          else {
            const size = byteLength(v);
            if (size > MAX_BYTES) {
              // Trop gros pour un seul document en ligne : gardé sur l'appareil seulement.
              this.pending.delete(key);
              this.setStatus({ message: "Un élément très volumineux reste seulement sur cet appareil." });
              continue;
            }
            if (bytes + size > BATCH_BYTES && sent.size) break;
            bytes += size;
            sets.push({ key, v });
          }
          sent.set(key, version);
        }
        if (!sent.size) break;
        await this.backend.push(sets, deletes);
        // Une clé modifiée pendant l'envoi reste dans la file pour le tour suivant.
        for (const [key, version] of sent) if (this.pending.get(key) === version) this.pending.delete(key);
        this.savePending();
      }
      this.retryDelay = 5000;
      this.setStatus({ state: "idle", lastSync: Date.now(), message: undefined });
    } catch (err) {
      this.savePending();
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      this.setStatus({ state: offline ? "offline" : "error", message: offline ? undefined : cloudErrorMessage(err) });
      // Nouvel essai de plus en plus espacé (5 s, 10 s… jusqu'à 2 min).
      this.schedule(this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 120_000);
    }
  }

  // ----- Récupération -----

  private cursor(): number {
    const n = Number(rawGet(CURSOR_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** Récupère les modifications faites ailleurs ; renvoie true si des données ont changé ici. */
  pull(): Promise<boolean> {
    if (this.pulling) return this.pulling;
    this.pulling = this.pullOnce().finally(() => {
      this.pulling = null;
    });
    return this.pulling;
  }

  private async pullOnce(): Promise<boolean> {
    const since = this.cursor();
    this.setStatus({ state: "syncing" });
    try {
      const { entries, cursor } = await this.backend.pull(since);
      if (this.stopped) return false;
      let changed = false;
      for (const [key, { v }] of entries) {
        if (!isSyncedKey(key) || this.pending.has(key)) continue; // modifié ici entre-temps : notre version part en ligne
        const local = rawGet(key);
        if (v === null) {
          if (local !== null) {
            rawRemove(key);
            changed = true;
          }
        } else if (local !== v) {
          rawSet(key, v);
          changed = true;
        }
      }
      if (since === 0) {
        // Récupération complète : ce qui n'existe que sur l'appareil est renvoyé (rien ne se perd).
        for (const key of localSyncedKeys()) if (!entries.has(key) && !this.pending.has(key)) this.pending.set(key, ++this.version);
        this.savePending();
      }
      rawSet(CURSOR_KEY, String(Math.max(cursor, since)));
      this.lastPull = Date.now();
      if (changed) rebuildIndexes();
      this.setStatus({ state: "idle", lastSync: Date.now(), message: undefined });
      if (this.pending.size) void this.flush();
      if (changed) this.onRemoteChange();
      return changed;
    } catch (err) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      this.setStatus({ state: offline ? "offline" : "error", message: offline ? undefined : cloudErrorMessage(err) });
      throw err;
    }
  }

  // ----- Première connexion sur cet appareil -----

  /** Envoie les données de l'appareil dans le compte, fusionnées avec celles déjà en ligne. */
  async importLocal() {
    const { entries, cursor } = await this.backend.pull(0);
    const remoteKeys = new Set<string>();
    for (const [key, { v }] of entries) {
      if (!isSyncedKey(key) || v === null) continue;
      remoteKeys.add(key);
      const local = rawGet(key);
      const merged = local === null ? v : mergeValue(key, local, v);
      if (merged !== local) rawSet(key, merged);
      if (merged !== v) this.pending.set(key, ++this.version);
    }
    for (const key of localSyncedKeys()) if (!remoteKeys.has(key)) this.pending.set(key, ++this.version);
    this.savePending();
    rawSet(CURSOR_KEY, String(cursor));
    rawSet(OWNER_KEY, this.uid);
    rebuildIndexes();
    this.lastPull = Date.now();
  }

  /** Commence avec les seules données du compte (celles de l'appareil sont retirées). */
  discardLocal() {
    clearLocalData();
    this.pending.clear();
    rawSet(OWNER_KEY, this.uid);
  }

  // ----- Cycle de vie -----

  /** Branche le repérage des écritures et les synchronisations automatiques. */
  start() {
    rawSet(OWNER_KEY, this.uid);
    current?.stop();
    current = this;
    this.stopped = false;
    installTracking();
    this.setStatus({});
    if (this.pending.size) this.schedule(0);
    if (typeof window === "undefined") return;
    const onOnline = () => void this.flush().then(() => this.pull().catch(() => {}));
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void this.flush();
      else if (Date.now() - this.lastPull > PULL_EVERY_MS) void this.pull().catch(() => {});
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    this.cleanup.push(
      () => window.removeEventListener("online", onOnline),
      () => document.removeEventListener("visibilitychange", onVisibility),
    );
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    if (current === this) current = null;
  }

  pendingCount = () => this.pending.size;
}

/** Messages clairs pour les erreurs de Firestore les plus courantes. */
export function cloudErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = err instanceof Error ? err.message : String(err);
  if (code === "permission-denied") return "La sauvegarde en ligne est refusée : vérifie les règles de Firestore (voir le README).";
  if (code === "not-found" || /database .* does not exist/i.test(message)) {
    return "La base Firestore n'est pas encore créée dans le projet Firebase (voir le README).";
  }
  if (code === "unauthenticated") return "Ta session a expiré : reconnecte-toi.";
  if (code === "resource-exhausted")
    return "Le quota gratuit de sauvegarde du jour est atteint : tes données restent sur l'appareil et partiront demain.";
  if (code === "unavailable" || code === "deadline-exceeded") return "Sauvegarde en ligne momentanément impossible : nouvel essai bientôt.";
  return "La sauvegarde en ligne a échoué : nouvel essai bientôt.";
}
