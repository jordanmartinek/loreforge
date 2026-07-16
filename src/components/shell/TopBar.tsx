import { useUiStore } from "../../store/uiStore";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-0)] px-6">
      <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h1>
      <div className="flex items-center gap-3">
        <SaveStatusIndicator />
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-2)]"
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
      </div>
    </header>
  );
}
