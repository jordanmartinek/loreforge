import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { EventFilter, EventPatch, NewEvent } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useEvents(filter: EventFilter = {}) {
  return useQuery({
    queryKey: queryKeys.events.list(filter),
    queryFn: () => api.events.list(filter),
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.detail(id ?? ""),
    queryFn: () => api.events.get(id as string),
    enabled: !!id,
  });
}

/** Invalidate every query that an event mutation could affect -- mirrors
 * invalidateCharacterQueries in useCharacters.ts. */
function invalidateEventQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.events.all });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewEvent) => {
      beginSave();
      return api.events.create(input);
    },
    onSuccess: () => {
      resolveSave();
      invalidateEventQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EventPatch }) => {
      beginSave();
      return api.events.update(id, patch);
    },
    onSuccess: (event) => {
      resolveSave();
      qc.setQueryData(queryKeys.events.detail(event.id), event);
      invalidateEventQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.events.delete(id);
    },
    onSuccess: () => {
      resolveSave();
      invalidateEventQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
