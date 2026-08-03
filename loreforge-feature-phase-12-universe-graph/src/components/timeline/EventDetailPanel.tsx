import { useState } from "react";
import { AutosaveField } from "../characters/AutosaveField";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { useCreateEvent, useDeleteEvent, useUpdateEvent } from "../../hooks/useEvents";
import { EVENT_LAYERS, type Event } from "../../lib/types";
import { RevisionHistoryPanel } from "../history/RevisionHistoryPanel";
import { EntityLocationLinks } from "../locations/EntityLocationLinks";
import { EntityTechnologyLinks } from "../technology/EntityTechnologyLinks";
import { EventParticipants } from "./EventParticipants";

const LAYER_LABELS: Record<string, string> = {
  historical: "Historical",
  political: "Political",
  military: "Military",
  technology: "Technology",
  character_life: "Character Life",
  wars: "Wars",
  books: "Books",
  screenplays: "Screenplays",
};

interface EventDetailPanelProps {
  /** `null` means "create a new event"; otherwise edit this event. */
  event: Event | null;
  onClose: () => void;
}

/** Create/edit UI for a single event. Follows the same autosave-on-existing
 * / explicit-create-then-edit pattern the app uses elsewhere: a brand new
 * event needs at least a name + start date before it can exist as a row at
 * all (FR5.1), after which every field switches to the same per-field
 * autosave behavior as Characters (FR5.2). */
export function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [draftName, setDraftName] = useState("");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const isCreateMode = event === null;

  const toggleLayer = (layer: string) => {
    if (!event) return;
    const nextLayers = event.layers.includes(layer)
      ? event.layers.filter((l) => l !== layer)
      : [...event.layers, layer];
    updateEvent.mutate({ id: event.id, patch: { layers: nextLayers } });
  };

  const handleCreate = async () => {
    setCreateError(null);
    try {
      await createEvent.mutateAsync({ name: draftName, start_date: draftStartDate });
      onClose();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create event");
    }
  };

  const handleDelete = () => {
    if (!event) return;
    deleteEvent.mutate(event.id);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isCreateMode ? "New Event" : event.name}
      footer={
        isCreateMode ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!draftName.trim() || !draftStartDate || createEvent.isPending}
            >
              Create Event
            </Button>
          </>
        ) : (
          <Button variant="danger" onClick={handleDelete}>
            Delete Event
          </Button>
        )
      }
    >
      {isCreateMode ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Name
            </label>
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="The AI War Begins"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Start Date
            </label>
            <Input
              type="date"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
            />
          </div>
          {createError && <p className="text-xs text-[var(--color-danger)]">{createError}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <AutosaveField
            label="Name"
            value={event.name}
            onCommit={(name) => updateEvent.mutate({ id: event.id, patch: { name } })}
          />
          <AutosaveField
            label="Description"
            value={event.description}
            onCommit={(description) =>
              updateEvent.mutate({ id: event.id, patch: { description } })
            }
            multiline
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Start Date
              </label>
              <Input
                type="date"
                defaultValue={event.start_date}
                onBlur={(e) =>
                  e.target.value &&
                  updateEvent.mutate({ id: event.id, patch: { start_date: e.target.value } })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                End Date (optional)
              </label>
              <Input
                type="date"
                defaultValue={event.end_date ?? ""}
                onBlur={(e) =>
                  updateEvent.mutate({
                    id: event.id,
                    patch: { end_date: e.target.value || null },
                  })
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Significance
            </label>
            <Select
              value={event.significance}
              onChange={(e) =>
                updateEvent.mutate({ id: event.id, patch: { significance: e.target.value } })
              }
            >
              <option value="minor">Minor</option>
              <option value="major">Major</option>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Layers
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENT_LAYERS.map((layer) => {
                const active = event.layers.includes(layer);
                return (
                  <button
                    key={layer}
                    onClick={() => toggleLayer(layer)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-hover)]"
                        : "border-[var(--color-border)] text-[var(--color-text-tertiary)]"
                    }`}
                  >
                    {LAYER_LABELS[layer] ?? layer}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Participants
            </h3>
            <EventParticipants eventId={event.id} />
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Location</h3>
            <EntityLocationLinks entityId={event.id} />
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Technology Used
            </h3>
            <EntityTechnologyLinks entityId={event.id} />
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--color-border-subtle)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">History</h3>
            <RevisionHistoryPanel entityId={event.id} />
          </div>
        </div>
      )}
    </Modal>
  );
}
