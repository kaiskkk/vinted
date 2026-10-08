// Configuration Firebase (comptes élèves), lue dans la variable VITE_FIREBASE_CONFIG.
// On accepte le bloc copié tel quel depuis la console Firebase (`const firebaseConfig = { apiKey: "…", … };`)
// ou du JSON. Ces valeurs sont publiques par nature : la sécurité vient des règles Firestore.

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const FIELDS = ["apiKey", "authDomain", "projectId", "appId", "storageBucket", "messagingSenderId"] as const;

export function parseFirebaseConfig(raw: string | undefined | null): FirebaseWebConfig | null {
  const text = raw?.trim();
  if (!text) return null;
  const values: Record<string, string> = {};
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    for (const f of FIELDS) if (typeof json[f] === "string") values[f] = json[f];
  } catch {
    // Pas du JSON : on lit les paires « clé: "valeur" » du bloc JavaScript.
    for (const m of text.matchAll(/["']?(\w+)["']?\s*:\s*(["'`])(.*?)\2/g)) {
      if ((FIELDS as readonly string[]).includes(m[1])) values[m[1]] = m[3];
    }
  }
  const { apiKey, projectId, appId } = values;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey: apiKey.trim(),
    projectId: projectId.trim(),
    appId: appId.trim(),
    authDomain: values.authDomain?.trim() || `${projectId.trim()}.firebaseapp.com`,
    ...(values.storageBucket ? { storageBucket: values.storageBucket.trim() } : {}),
    ...(values.messagingSenderId ? { messagingSenderId: values.messagingSenderId.trim() } : {}),
  };
}
