import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useState } from "react";
import { useCharacters, useCreateCharacter, useDeleteCharacter } from "../../hooks/useCharacters";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import type { Character } from "../../lib/types";

const ROLE_TONE: Record<string, "accent" | "neutral"> = {
  main: "accent",
  supporting: "neutral",
  minor: "neutral",
};

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  alive: "success",
  dead: "danger",
  unknown: "warning",
  other: "neutral",
};

interface CharacterListProps {
  selectedId: string | null;
  onSelect: (character: Character) => void;
}

export function CharacterList({ selectedId, onSelect }: CharacterListProps) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const { data: characters = [], isLoading } = useCharacters({
    search: search || undefined,
    role: role || undefined,
    status: status || undefined,
  });

  const createCharacter = useCreateCharacter();
  const deleteCharacter = useDeleteCharacter();

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: characters.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const handleCreate = async () => {
    const character = await createCharacter.mutateAsync({ name: "New Character" });
    onSelect(character);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search characters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={handleCreate} disabled={createCharacter.isPending}>
          + New
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="flex-1">
          <option value="">All roles</option>
          <option value="main">Main</option>
          <option value="supporting">Supporting</option>
          <option value="minor">Minor</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-1">
          <option value="">All statuses</option>
          <option value="alive">Alive</option>
          <option value="dead">Dead</option>
          <option value="unknown">Unknown</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {isLoading ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">Loading…</p>
      ) : characters.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-text-tertiary)]">
          No characters yet. Create your first one above.
        </p>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto rounded-md border border-[var(--color-border-subtle)]">
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const character = characters[virtualRow.index];
              const isSelected = character.id === selectedId;
              return (
                <div
                  key={character.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`group flex items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] px-3
                    ${isSelected ? "bg-[var(--color-accent-muted)]" : "hover:bg-[var(--color-bg-2)]"}`}
                >
                  <button
                    onClick={() => onSelect(character)}
                    className="flex flex-1 flex-col items-start gap-1 py-2 text-left"
                  >
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {character.name}
                    </span>
                    <span className="flex gap-1.5">
                      <Badge tone={ROLE_TONE[character.role] ?? "neutral"}>{character.role}</Badge>
                      <Badge tone={STATUS_TONE[character.status] ?? "neutral"}>
                        {character.status}
                      </Badge>
                    </span>
                  </button>
                  <button
                    onClick={() => deleteCharacter.mutate(character.id)}
                    className="hidden rounded-md px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] group-hover:block"
                    aria-label={`Delete ${character.name}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
