import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./index.css";
import App from "./App";
import { AccountGate } from "./components/AccountGate";
import { accountsEnabled } from "./lib/account";

// iOS : empêche le pincement de zoomer toute la page (le canevas gère son propre zoom).
for (const type of ["gesturestart", "gesturechange"]) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

// Impression : toujours sur fond blanc, même en thème sombre.
window.addEventListener("beforeprint", () => {
  const root = document.documentElement;
  if (root.classList.contains("dark")) {
    root.dataset.printDark = "1";
    root.classList.remove("dark");
  }
});
window.addEventListener("afterprint", () => {
  const root = document.documentElement;
  if (root.dataset.printDark) {
    delete root.dataset.printDark;
    root.classList.add("dark");
  }
});

// Application installable et consultable hors connexion (uniquement sur le site compilé).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sans service worker, le site fonctionne normalement, simplement pas hors connexion.
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Comptes activés (VITE_FIREBASE_CONFIG) : connexion obligatoire. Sinon, le site fonctionne comme avant, sans compte. */}
    {accountsEnabled ? (
      <AccountGate>
        <App />
      </AccountGate>
    ) : (
      <App />
    )}
  </StrictMode>,
);
