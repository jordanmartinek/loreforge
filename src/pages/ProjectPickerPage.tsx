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
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Your Universes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a project to continue, or start a new one.
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        {sorted.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No projects yet — create your first one below.
          </p>
        )}

        {sorted.map((project) => (
          <div
            key={project.id}
            className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
          >
            <button
              type="button"
              onClick={() => openProject(project.id)}
              className="flex-1 text-left"
            >
              <div className="font-medium">{project.name}</div>
              <div className="text-xs text-muted-foreground">
                Last opened {new Date(project.lastOpenedAt).toLocaleDateString()}
              </div>
            </button>
            <button
              type="button"
              onClick={() => deleteProject(project.id)}
              className="ml-3 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
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
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="w-full rounded-md border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
          >
            + New Project
          </button>
        )}
      </div>
    </div>
  );
}
