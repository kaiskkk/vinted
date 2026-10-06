import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

/** Thème sombre par défaut, mémorisé dans le navigateur. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("mm-theme", theme);
    } catch {
      // Stockage indisponible (navigation privée) : le thème ne sera simplement pas mémorisé.
    }
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
