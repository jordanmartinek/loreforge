import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { CanonEntryPatch, CanonFilter, NewCanonEntry } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useCanonEntries(filter: CanonFilter = {}) {
  return useQuery({
    queryKey: queryKeys.canon.list(filter),
    queryFn: () => api.canon.list(filter),
  });
}

export function useCanonEntry(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.canon.detail(id ?? ""),
    queryFn: () => api.canon.get(id as string),
    enabled: !!id,
  });
}

/** Invalidate every query a canon mutation could affect -- mirrors
 * invalidateEventQueries in useEvents.ts. Also invalidates revisions
 * queries, since every canon mutation writes a new revision row that a
 * currently-open History panel should immediately reflect. */
function invalidateCanonQueries(qc: ReturnType<typeof useQueryClient>, entityId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.canon.all });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  if (entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.revisions.forEntity(entityId) });
  }
}

export function useCreateCanonEntry() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewCanonEntry) => {
      beginSave();
      return api.canon.create(input);
    },
    onSuccess: (entry) => {
      resolveSave();
      invalidateCanonQueries(qc, entry.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateCanonEntry() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CanonEntryPatch }) => {
      beginSave();
      return api.canon.update(id, patch);
    },
    onSuccess: (entry) => {
      resolveSave();
      qc.setQueryData(queryKeys.canon.detail(entry.id), entry);
      invalidateCanonQueries(qc, entry.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteCanonEntry() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.canon.delete(id);
    },
    onSuccess: (_data, id) => {
      resolveSave();
      invalidateCanonQueries(qc, id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
