import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { NewRelationship, RelationshipPatch } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useAllRelationships() {
  return useQuery({
    queryKey: queryKeys.relationships.all,
    queryFn: () => api.relationships.listAll(),
  });
}

export function useRelationshipsForEntity(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.relationships.forEntity(entityId ?? ""),
    queryFn: () => api.relationships.listForEntity(entityId as string),
    enabled: !!entityId,
  });
}

function invalidateRelationshipQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
}

export function useCreateRelationship() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewRelationship) => {
      beginSave();
      return api.relationships.create(input);
    },
    onSuccess: () => {
      resolveSave();
      invalidateRelationshipQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateRelationship() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RelationshipPatch }) => {
      beginSave();
      return api.relationships.update(id, patch);
    },
    onSuccess: () => {
      resolveSave();
      invalidateRelationshipQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteRelationship() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.relationships.delete(id);
    },
    onSuccess: () => {
      resolveSave();
      invalidateRelationshipQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
