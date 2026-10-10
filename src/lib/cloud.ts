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
  addDoc,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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

// ---------- Partage par lien ----------

export interface SharedDoc {
  kind: string;
  titre: string;
  /** Contenu partagé (JSON), copie figée au moment du partage. */
  data: string;
}

/** Publie une copie dans partages/{id} : lisible par tout élève connecté qui a le lien. */
export async function publishShare(id: string, shared: SharedDoc) {
  const { auth, db } = ready();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Connecte-toi pour partager.");
  await setDoc(doc(db, "partages", id), { ...shared, proprietaire: uid, createdAt: serverTimestamp() });
}

export async function fetchShare(id: string): Promise<SharedDoc | null> {
  const snap = await getDoc(doc(ready().db, "partages", id));
  if (!snap.exists()) return null;
  const d = snap.data() as Partial<SharedDoc>;
  return typeof d.kind === "string" && typeof d.data === "string"
    ? { kind: d.kind, titre: typeof d.titre === "string" ? d.titre : "", data: d.data }
    : null;
}

// ---------- Mode classe ----------

export const currentUid = () => ready().auth.currentUser?.uid ?? null;

function requireUid() {
  const uid = currentUid();
  if (!uid) throw new Error("Connecte-toi pour utiliser le mode classe.");
  return uid;
}

const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : Date.now());
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Crée la classe (classes/{code}), puis inscrit son créateur comme premier membre. */
export async function createClasseDoc(code: string, data: { nom: string; tousPartagent: boolean }, prenom: string) {
  const uid = requireUid();
  const { db } = ready();
  await setDoc(doc(db, "classes", code), {
    nom: data.nom,
    proprietaire: uid,
    ouverte: true,
    tousPartagent: data.tousPartagent,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, "classes", code, "membres", uid), { nom: prenom, createdAt: serverTimestamp() });
}

/** Rejoindre avec le code : l'élève s'inscrit lui-même (refusé si le code est faux ou la classe fermée). */
export async function joinClasseDoc(code: string, prenom: string) {
  const uid = requireUid();
  await setDoc(doc(ready().db, "classes", code, "membres", uid), { nom: prenom, createdAt: serverTimestamp() });
}

export async function fetchClasseDoc(code: string) {
  const snap = await getDoc(doc(ready().db, "classes", code));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    code,
    nom: str(d.nom, 80) || "Ma classe",
    proprietaire: str(d.proprietaire, 200),
    ouverte: d.ouverte !== false,
    tousPartagent: d.tousPartagent === true,
  };
}

export async function updateClasseDoc(code: string, patch: Partial<{ nom: string; ouverte: boolean; tousPartagent: boolean }>) {
  await updateDoc(doc(ready().db, "classes", code), patch);
}

export async function listClasseMembres(code: string) {
  const snap = await getDocs(collection(ready().db, "classes", code, "membres"));
  return snap.docs
    .map((d) => ({ uid: d.id, nom: str(d.data().nom, 40) || "Sans nom", createdAt: millis(d.data().createdAt) }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export const removeClasseMembre = (code: string, uid: string) => deleteDoc(doc(ready().db, "classes", code, "membres", uid));

function toClasseDocument(d: { id: string; data: () => Record<string, unknown> }) {
  const x = d.data();
  return {
    id: d.id,
    kind: str(x.kind, 40),
    titre: str(x.titre, 140),
    data: typeof x.data === "string" ? x.data : "",
    auteur: str(x.auteur, 200),
    auteurNom: str(x.auteurNom, 40),
    createdAt: millis(x.createdAt),
  };
}

export async function latestClasseDocuments(code: string, n = 100) {
  const snap = await getDocs(query(collection(ready().db, "classes", code, "documents"), orderBy("createdAt", "desc"), limit(n)));
  return snap.docs.map(toClasseDocument);
}

export async function addClasseDocument(code: string, shared: SharedDoc, auteurNom: string) {
  const uid = requireUid();
  await addDoc(collection(ready().db, "classes", code, "documents"), { ...shared, auteur: uid, auteurNom, createdAt: serverTimestamp() });
}

export const deleteClasseDocument = (code: string, id: string) => deleteDoc(doc(ready().db, "classes", code, "documents", id));

/** Supprime la classe avec ses documents et ses membres (réservé à son créateur). */
export async function deleteClasseDeep(code: string) {
  const { db } = ready();
  const uid = requireUid();
  for (const sub of ["documents", "membres"]) {
    const snap = await getDocs(collection(db, "classes", code, sub));
    // Le créateur s'efface en dernier : tant qu'il est membre, il garde l'accès aux documents.
    const refs = snap.docs.filter((d) => !(sub === "membres" && d.id === uid)).map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach((r) => batch.delete(r));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, "classes", code, "membres", uid));
  await deleteDoc(doc(db, "classes", code));
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
