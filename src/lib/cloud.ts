// Comptes élèves avec Firebase (gratuit) : connexion par email et mot de passe, et sauvegarde
// des données dans Firestore (utilisateurs/{uid}/donnees/{clé}). Chargé seulement si les comptes sont activés.
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  Timestamp,
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore/lite";
import type { FirebaseWebConfig } from "../../shared/firebaseConfig";
import type { CloudBackend, RemoteEntry } from "./sync";

let auth: Auth | null = null;
let db: Firestore | null = null;

export function initCloud(config: FirebaseWebConfig) {
  if (auth && db) return;
  const app = initializeApp(config);
  // Sans les fenêtres de connexion Google/Apple : seulement email et mot de passe (bundle plus léger).
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  auth.languageCode = "fr";
  db = getFirestore(app);
  const emulator = import.meta.env.VITE_FIREBASE_EMULATOR as string | undefined;
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulator, 8080);
  }
}

const ready = () => {
  if (!auth || !db) throw new Error("Firebase n'est pas initialisé.");
  return { auth, db };
};

export const watchUser = (fn: (user: User | null) => void) => onAuthStateChanged(ready().auth, fn);

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(ready().auth, email.trim(), password);
}

export async function signUp(email: string, password: string) {
  await createUserWithEmailAndPassword(ready().auth, email.trim(), password);
}

export const resetPassword = (email: string) => sendPasswordResetEmail(ready().auth, email.trim());

export const logout = () => signOut(ready().auth);

/** Jeton envoyé au serveur pour prouver que l'élève est connecté (renouvelé automatiquement). */
export const getToken = async (force = false) => (auth?.currentUser ? auth.currentUser.getIdToken(force) : null);

// Firestore interdit « / » dans un identifiant de document.
const encodeKey = (key: string) => key.replace(/%/g, "%25").replace(/\//g, "%2F");
const decodeKey = (id: string) => id.replace(/%2F/g, "/").replace(/%25/g, "%");

export function createBackend(uid: string): CloudBackend {
  const { db } = ready();
  const col = collection(db, "utilisateurs", uid, "donnees");
  return {
    async pull(since) {
      const snap = await getDocs(since > 0 ? query(col, where("t", ">", Timestamp.fromMillis(since))) : col);
      const entries = new Map<string, RemoteEntry>();
      let cursor = since;
      for (const d of snap.docs) {
        const data = d.data() as { v?: unknown; t?: unknown };
        if (data.t instanceof Timestamp) cursor = Math.max(cursor, data.t.toMillis());
        entries.set(decodeKey(d.id), { v: typeof data.v === "string" ? data.v : null });
      }
      return { entries, cursor };
    },
    async push(sets, deletes) {
      const batch = writeBatch(db);
      for (const { key, v } of sets) batch.set(doc(col, encodeKey(key)), { v, t: serverTimestamp() });
      // Suppression gardée en ligne (v: null) pour que les autres appareils la voient aussi.
      for (const key of deletes) batch.set(doc(col, encodeKey(key)), { v: null, t: serverTimestamp() });
      await batch.commit();
    },
  };
}

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-email": "Cette adresse email n'est pas valide.",
  "auth/missing-email": "Écris ton adresse email.",
  "auth/missing-password": "Écris ton mot de passe.",
  "auth/weak-password": "Mot de passe trop court : au moins 6 caractères.",
  "auth/password-does-not-meet-requirements": "Mot de passe trop simple : au moins 6 caractères.",
  "auth/email-already-in-use": "Un compte existe déjà avec cette adresse : connecte-toi.",
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/invalid-login-credentials": "Email ou mot de passe incorrect.",
  "auth/wrong-password": "Email ou mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec cette adresse : crée ton compte.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/too-many-requests": "Trop d'essais d'affilée. Attends quelques minutes puis réessaie.",
  "auth/network-request-failed": "Pas de connexion internet. Reconnecte-toi puis réessaie.",
  "auth/operation-not-allowed": "La connexion par email n'est pas activée dans Firebase (Authentication → Email/Mot de passe).",
  "auth/configuration-not-found": "Firebase Authentication n'est pas activé dans le projet (Authentication → Commencer).",
  "auth/invalid-api-key": "La configuration Firebase est invalide : vérifie la variable VITE_FIREBASE_CONFIG.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "La configuration Firebase est invalide : vérifie la variable VITE_FIREBASE_CONFIG.",
  "auth/unauthorized-domain": "Ce site n'est pas autorisé dans Firebase (Authentication → Paramètres → Domaines autorisés).",
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  return AUTH_ERRORS[code] ?? "La connexion a échoué. Réessaie dans un instant.";
}
