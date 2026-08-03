import { useState } from "react";
import { CharacterDetail } from "../components/characters/CharacterDetail";
import { CharacterList } from "../components/characters/CharacterList";
import type { Character } from "../lib/types";

export function CharactersPage() {
  const [selected, setSelected] = useState<Character | null>(null);

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0">
        <CharacterList selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <div className="flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] p-6">
        {selected ? (
          <CharacterDetail characterId={selected.id} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
            Select a character, or create a new one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
