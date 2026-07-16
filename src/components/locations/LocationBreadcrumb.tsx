import { useLocationAncestry } from "../../hooks/useLocations";
import type { Location } from "../../lib/types";

interface LocationBreadcrumbProps {
  location: Location;
  onNavigate: (location: Location) => void;
}

/** Renders the ancestry chain from useLocationAncestry as a clickable
 * breadcrumb (FR5.2), e.g. "Milky Way > Sol System > Earth > New Geneva". */
export function LocationBreadcrumb({ location, onNavigate }: LocationBreadcrumbProps) {
  const { data: ancestry = [] } = useLocationAncestry(location.id);

  // ancestry is immediate-parent-first, root-last (per get_ancestry_chain);
  // reverse for a natural left-to-right root-to-leaf breadcrumb.
  const rootToLeaf = [...ancestry].reverse();

  return (
    <nav
      aria-label="Location breadcrumb"
      className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]"
    >
      {rootToLeaf.map((ancestor) => (
        <span key={ancestor.id} className="flex items-center gap-1.5">
          <button
            onClick={() => onNavigate(ancestor)}
            className="hover:text-[var(--color-text-primary)] hover:underline"
          >
            {ancestor.name}
          </button>
          <span>›</span>
        </span>
      ))}
      <span className="font-medium text-[var(--color-text-secondary)]">{location.name}</span>
    </nav>
  );
}
