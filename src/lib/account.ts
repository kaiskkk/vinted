// État du compte, partagé par tout le site (léger : Firebase n'est chargé que si les comptes sont activés).
import { useEffect, useState } from "react";
import { parseFirebaseConfig } from "../../shared/firebaseConfig";
import type { CloudSync, SyncStatus } from "./sync";

/** Configuration collée dans la variable VITE_FIREBASE_CONFIG (Netlify) ; sans elle, pas de comptes. */
export const firebaseConfig = parseFirebaseConfig(import.meta.env.VITE_FIREBASE_CONFIG as string | undefined);
export const accountsEnabled = firebaseConfig !== null;

type TokenProvider = (force?: boolean) => Promise<string | null>;
let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(fn: TokenProvider | null) {
  tokenProvider = fn;
}

/** Jeton de connexion pour le serveur (null sans compte). */
export async function authToken(force = false): Promise<string | null> {
  if (!tokenProvider) return null;
  try {
    return await tokenProvider(force);
  } catch {
    return null;
  }
}

export interface AccountSession {
  email: string;
  sync: CloudSync;
  logout: () => Promise<void>;
}

let session: AccountSession | null = null;
const listeners = new Set<() => void>();

export function setSession(s: AccountSession | null) {
  session = s;
  listeners.forEach((l) => l());
}

export const getSession = () => session;

/** Compte connecté (null si les comptes ne sont pas activés). */
export function useSession(): AccountSession | null {
  const [s, setS] = useState(session);
  useEffect(() => {
    const l = () => setS(session);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}

/** État de la sauvegarde en ligne, mis à jour en direct. */
export function useSyncStatus(sync: CloudSync | undefined): SyncStatus | null {
  const [status, setStatus] = useState<SyncStatus | null>(() => sync?.getStatus() ?? null);
  useEffect(() => {
    if (!sync) return;
    setStatus(sync.getStatus());
    return sync.onStatus(setStatus);
  }, [sync]);
  return status;
}
