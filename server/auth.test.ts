import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { createApi } from "./api";
import { createFirebaseVerifier, firebaseProjectId } from "./auth";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "cle1", alg: "RS256" };
const keys = createLocalJWKSet({ keys: [jwk] });

const token = (claims: { aud?: string; iss?: string; sub?: string; exp?: number }) =>
  new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "cle1" })
    .setIssuedAt()
    .setAudience(claims.aud ?? "ecoleduc")
    .setIssuer(claims.iss ?? "https://securetoken.google.com/ecoleduc")
    .setSubject(claims.sub ?? "eleve1")
    .setExpirationTime(claims.exp ?? "1h")
    .sign(privateKey);

describe("vérification des comptes", () => {
  const verify = createFirebaseVerifier("ecoleduc", { keys });

  it("accepte un jeton Firebase valide", async () => {
    expect(await verify(await token({}))).toBe("eleve1");
  });

  it("refuse un jeton d'un autre projet, expiré ou falsifié", async () => {
    await expect(verify(await token({ aud: "autre" }))).rejects.toThrow();
    await expect(verify(await token({ iss: "https://securetoken.google.com/autre" }))).rejects.toThrow();
    await expect(verify(await token({ exp: Math.floor(Date.now() / 1000) - 60 }))).rejects.toThrow();
    const t = await token({});
    await expect(verify(`${t.slice(0, -4)}abcd`)).rejects.toThrow();
    await expect(verify("pas-un-jeton")).rejects.toThrow();
  });

  it("lit l'identifiant du projet dans la même variable que le front", () => {
    expect(firebaseProjectId({ VITE_FIREBASE_CONFIG: 'const firebaseConfig = { apiKey: "k", projectId: "mon-projet", appId: "a" };' })).toBe(
      "mon-projet",
    );
    expect(firebaseProjectId({})).toBeNull();
  });

  it("exige d'être connecté pour utiliser l'IA", async () => {
    const api = createApi({
      generator: { generate: async () => ({ titre: "T", noeuds: [{ id: "a", texte: "T", parentId: null, couleur: "", emoji: "" }] }) },
      hasApiKey: () => true,
      verifyUser: verify,
    });
    const body = { mode: "replace", prompt: "Les volcans" };
    const sans = await api.generate(body, {});
    expect(sans.status).toBe(401);
    expect(sans.body).toMatchObject({ code: "CONNEXION_REQUISE" });
    expect((await api.generate(body, { authorization: "Bearer faux" })).status).toBe(401);
    expect((await api.generate(body, { authorization: `Bearer ${await token({})}` })).status).toBe(200);
    expect(api.health().body).toMatchObject({ comptes: true });
  });
});
