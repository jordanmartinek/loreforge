import { useState } from "react";
import { useProjectStore } from "../store/projectStore";

export function ProjectPickerPage() {
  const projects = useProjectStore((s) => s.projects);
  const error = useProjectStore((s) => s.error);
  const createProject = useProjectStore((s) => s.createProject);
  const openProject = useProjectStore((s) => s.openProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const sorted = [...projects].sort(
    (a, b) => new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime(),
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setPendingId("__new__");
    try {
      await createProject(newName);
      setNewName("");
      setIsCreating(false);
    } catch {
      // error surfaced via store's `error` field
    } finally {
      setPendingId(null);
    }
  }

  async function handleOpen(id: string) {
    setPendingId(id);
    try {
      await openProject(id);
    } catch {
      // error surfaced via store's `error` field
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 bg-[var(--color-bg-0)] px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Your Universes
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Pick a project to continue, or start a new one.
        </p>
      </div>

      {error && (
        <p className="max-w-md text-center text-sm text-red-500">{error}</p>
      )}

      <div className="w-full max-w-md space-y-3">
        {sorted.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-secondary)]">
            No projects yet — create your first one below.
          </p>
        )}

        {sorted.map((project) => (
          <div
            key={project.id}
            className="group flex items-center justify-between rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] px-4 py-3"
          >
            <button
              type="button"
              onClick={() => handleOpen(project.id)}
              disabled={pendingId !== null}
              className="flex-1 text-left disabled:opacity-50"
            >
              <div className="font-medium text-[var(--color-text-primary)]">
                {project.name}
                {pendingId === project.id && (
                  <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                    Opening…
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                Last opened {new Date(project.last_opened_at).toLocaleDateString()}
              </div>
            </button>
            <button
              type="button"
              onClick={() => deleteProject(project.id)}
              disabled={pendingId !== null}
              className="ml-3 text-xs text-[var(--color-text-secondary)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 disabled:opacity-0"
              aria-label={`Delete ${project.name}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">
        {isCreating ? (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Universe name"
              disabled={pendingId !== null}
              className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-0)] px-3 py-2 text-sm text-[var(--color-text-primary)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pendingId !== null}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pendingId === "__new__" ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              disabled={pendingId !== null}
              className="rounded-md px-3 py-2 text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="w-full rounded-md border border-dashed border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            + New Project
          </button>
        )}
      </div>
    </div>
  );
}
