import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: "◈" },
  { to: "/characters", label: "Characters", icon: "☰" },
  { to: "/graph", label: "Universe Graph", icon: "◎" },
  { to: "/timeline", label: "Timeline", icon: "⟿" },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-1)]">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-accent)] text-sm font-bold text-white">
          L
        </div>
        <span className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
          LoreForge AI
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-hover)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-2)] hover:text-[var(--color-text-primary)]"
              }`
            }
          >
            <span className="w-4 text-center text-xs">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-[11px] text-[var(--color-text-tertiary)]">
        Phase 2 · Local-first
      </div>
    </aside>
  );
}
