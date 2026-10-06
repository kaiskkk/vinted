import type { Theme } from "../hooks/useTheme";
import { MoonIcon, SunIcon } from "./Icons";
import { btn } from "./Modal";

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const label = theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre";
  return (
    <button type="button" onClick={onToggle} className={btn.icon} title={label} aria-label={label}>
      <span key={theme} className="animate-pop">
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
