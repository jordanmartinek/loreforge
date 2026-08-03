import { useProjectStore } from "../../store/projectStore";
import { useUiStore } from "../../store/uiStore";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  const currentProject = useProjectStore((s) => s.currentProject());
  const closeProject = useProjectStore((s) => s.closeProject);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-0)] px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h1>
        {currentProject && (
          <>
            <span className="text-[var(--color-text-secondary)]">/</span>
            <button
              onClick={closeProject}
              className="rounded-md px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-2)]"
              title="Switch project"
            >
              {currentProject.name} <span className="ml-1 opacity-60">⇄</span>
            </button>
          </>
        )}
      </div>
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
