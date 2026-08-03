import { useState } from "react";
import { useProjectStore } from "../store/projectStore";

export function ProjectPickerPage() {
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const openProject = useProjectStore((s) => s.openProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const sorted = [...projects].sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createProject(newName);
    setNewName("");
    setIsCreating(false);
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
              onClick={() => openProject(project.id)}
              className="flex-1 text-left"
            >
              <div className="font-medium text-[var(--color-text-primary)]">
                {project.name}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                Last opened {new Date(project.lastOpenedAt).toLocaleDateString()}
              </div>
            </button>
            <button
              type="button"
              onClick={() => deleteProject(project.id)}
              className="ml-3 text-xs text-[var(--color-text-secondary)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
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
              className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-0)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded-md px-3 py-2 text-sm text-[var(--color-text-secondary)]"
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
