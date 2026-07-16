import { useCharacter, useUpdateCharacter } from "../../hooks/useCharacters";
import type { CharacterPatch } from "../../lib/types";
import { AutosaveField } from "./AutosaveField";
import { CharacterTimeline } from "./CharacterTimeline";
import { RelationshipEditor } from "./RelationshipEditor";
import { RevisionHistoryButton } from "../history/RevisionHistoryPanel";
import { EntityLocationLinks } from "../locations/EntityLocationLinks";
import { Select } from "../ui/Select";

interface CharacterDetailProps {
  characterId: string;
}

export function CharacterDetail({ characterId }: CharacterDetailProps) {
  const { data: character, isLoading } = useCharacter(characterId);
  const updateCharacter = useUpdateCharacter();

  if (isLoading || !character) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">Loading…</p>;
  }

  const commit = (patch: CharacterPatch) => {
    updateCharacter.mutate({ id: character.id, patch });
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto pr-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <AutosaveField
            label="Name"
            value={character.name}
            onCommit={(name) => commit({ name })}
          />
        </div>
        <div className="pt-5">
          <RevisionHistoryButton entityId={character.id} entityName={character.name} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Role
          </label>
          <Select
            value={character.role}
            onChange={(e) => commit({ role: e.target.value })}
          >
            <option value="main">Main</option>
            <option value="supporting">Supporting</option>
            <option value="minor">Minor</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Status
          </label>
          <Select
            value={character.status}
            onChange={(e) => commit({ status: e.target.value })}
          >
            <option value="alive">Alive</option>
            <option value="dead">Dead</option>
            <option value="unknown">Unknown</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
        <input
          type="checkbox"
          checked={character.needs_development}
          onChange={(e) => commit({ needs_development: e.target.checked })}
          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
        />
        Flag as &ldquo;Needs Development&rdquo;
      </label>

      <Section title="Biography">
        <AutosaveField
          label="Biography"
          value={character.biography}
          onCommit={(v) => commit({ biography: v })}
          multiline
        />
      </Section>

      <Section title="Appearance">
        <AutosaveField
          label="Appearance"
          value={character.appearance}
          onCommit={(v) => commit({ appearance: v })}
          multiline
        />
      </Section>

      <Section title="Psychology">
        <div className="grid grid-cols-2 gap-4">
          <AutosaveField
            label="Goals"
            value={character.goals}
            onCommit={(v) => commit({ goals: v })}
            multiline
          />
          <AutosaveField
            label="Needs"
            value={character.needs}
            onCommit={(v) => commit({ needs: v })}
            multiline
          />
          <AutosaveField
            label="Flaws"
            value={character.flaws}
            onCommit={(v) => commit({ flaws: v })}
            multiline
          />
          <AutosaveField
            label="Secrets"
            value={character.secrets}
            onCommit={(v) => commit({ secrets: v })}
            multiline
          />
        </div>
        <AutosaveField
          label="Psychology Notes"
          value={character.psychology}
          onCommit={(v) => commit({ psychology: v })}
          multiline
        />
        <AutosaveField
          label="Dialogue Style"
          value={character.dialogue_style}
          onCommit={(v) => commit({ dialogue_style: v })}
          multiline
        />
      </Section>

      <Section title="Relationships">
        <RelationshipEditor characterId={character.id} />
      </Section>

      <Section title="Timeline">
        <CharacterTimeline characterId={character.id} />
      </Section>

      <Section title="Location">
        <EntityLocationLinks entityId={character.id} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {children}
    </div>
  );
}
