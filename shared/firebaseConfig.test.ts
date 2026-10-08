import { describe, expect, it } from "vitest";
import { parseFirebaseConfig } from "./firebaseConfig";

describe("configuration Firebase", () => {
  it("lit le bloc copié depuis la console Firebase", () => {
    const pasted = `// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD-exemple",
  authDomain: "ecoleduc-123.firebaseapp.com",
  projectId: "ecoleduc-123",
  storageBucket: "ecoleduc-123.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
  measurementId: "G-XYZ"
};`;
    expect(parseFirebaseConfig(pasted)).toEqual({
      apiKey: "AIzaSyD-exemple",
      authDomain: "ecoleduc-123.firebaseapp.com",
      projectId: "ecoleduc-123",
      storageBucket: "ecoleduc-123.firebasestorage.app",
      messagingSenderId: "1234567890",
      appId: "1:1234567890:web:abcdef",
    });
  });

  it("accepte le JSON et complète le domaine", () => {
    expect(parseFirebaseConfig('{"apiKey":"k","projectId":"p","appId":"a"}')).toEqual({
      apiKey: "k",
      projectId: "p",
      appId: "a",
      authDomain: "p.firebaseapp.com",
    });
  });

  it("refuse une configuration vide ou incomplète", () => {
    expect(parseFirebaseConfig(undefined)).toBeNull();
    expect(parseFirebaseConfig("   ")).toBeNull();
    expect(parseFirebaseConfig('apiKey: "k", projectId: "p"')).toBeNull();
  });
});
