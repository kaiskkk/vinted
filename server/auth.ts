// Comptes élèves (Firebase) : le serveur vérifie le jeton de connexion avant d'appeler l'IA,
// pour que seuls les élèves inscrits utilisent le quota gratuit.
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from "jose";
import { parseFirebaseConfig } from "../shared/firebaseConfig";

const GOOGLE_KEYS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

/** Identifiant du projet Firebase (même variable que le front), ou null si les comptes ne sont pas activés. */
export function firebaseProjectId(env: Record<string, string | undefined> = process.env): string | null {
  return env.FIREBASE_PROJECT_ID?.trim() || parseFirebaseConfig(env.VITE_FIREBASE_CONFIG)?.projectId || null;
}

/** Renvoie l'identifiant de l'élève si le jeton est valide, sinon lève une erreur. */
export type VerifyUser = (token: string) => Promise<string>;

export function createFirebaseVerifier(projectId: string, options: { keys?: JWTVerifyGetKey; emulator?: boolean } = {}): VerifyUser {
  const keys = options.keys ?? createRemoteJWKSet(new URL(GOOGLE_KEYS));
  const issuer = `https://securetoken.google.com/${projectId}`;
  return async (token) => {
    if (options.emulator) {
      // Émulateur local : les jetons ne sont pas signés, on vérifie seulement le projet.
      const p = decodeJwt(token);
      if (p.aud !== projectId || p.iss !== issuer || !p.sub) throw new Error("Jeton d'émulateur invalide.");
      return p.sub;
    }
    const { payload } = await jwtVerify(token, keys, { issuer, audience: projectId, algorithms: ["RS256"] });
    if (!payload.sub) throw new Error("Jeton sans utilisateur.");
    return payload.sub;
  };
}

/** Vérificateur configuré d'après l'environnement, ou undefined si les comptes ne sont pas activés. */
export function verifierFromEnv(env: Record<string, string | undefined> = process.env): VerifyUser | undefined {
  const projectId = firebaseProjectId(env);
  if (!projectId) return undefined;
  return createFirebaseVerifier(projectId, { emulator: Boolean(env.FIREBASE_AUTH_EMULATOR_HOST) });
}
