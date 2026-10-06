import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const CHOICE_KEY = "mm-theme-choice";
const THEME_COLORS: Record<Theme, string> = { dark: "#0b0e17", light: "#f8fafc" };
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readChoice(): Theme | null {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

function writeChoice(choice: Theme | null) {
  try {
    if (choice) localStorage.setItem(CHOICE_KEY, choice);
    else localStorage.removeItem(CHOICE_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : le choix ne sera pas mémorisé.
  }
}

/**
 * Thème clair / sombre. Par défaut il suit le réglage du téléphone (et ses changements) ;
 * un choix manuel est mémorisé, et revenir au thème du système repasse en mode automatique.
 */
export function useTheme() {
  const [choice, setChoice] = useState<Theme | null>(readChoice);
  const [system, setSystem] = useState<Theme>(() => (darkQuery().matches ? "dark" : "light"));
  const theme = choice ?? system;

  useEffect(() => {
    const mq = darkQuery();
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const nextChoice = next === system ? null : next;
    setChoice(nextChoice);
    writeChoice(nextChoice);
  };

  return { theme, toggle, auto: choice === null };
}
