import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { NewPoliticalEntity, PoliticalEntityFilter, PoliticalEntityPatch } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function usePoliticalEntities(filter: PoliticalEntityFilter = {}) {
  return useQuery({
    queryKey: queryKeys.politics.list(filter),
    queryFn: () => api.politics.list(filter),
  });
}

export function usePoliticalEntity(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.politics.detail(id ?? ""),
    queryFn: () => api.politics.get(id as string),
    enabled: !!id,
  });
}

/** Powers DiplomaticRelations.tsx's allies list (FR3.4), resolved
 * direction-agnostically -- see politics::list_allies in loreforge-core. */
export function useAllies(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.politics.allies(entityId ?? ""),
    queryFn: () => api.politics.listAllies(entityId as string),
    enabled: !!entityId,
  });
}

/** Powers DiplomaticRelations.tsx's rivals list (FR3.4). See useAllies. */
export function useRivals(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.politics.rivals(entityId ?? ""),
    queryFn: () => api.politics.listRivals(entityId as string),
    enabled: !!entityId,
  });
}

function invalidatePoliticsQueries(qc: ReturnType<typeof useQueryClient>, entityId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.politics.all });
  qc.invalidateQueries({ queryKey: ["politics", "allies"] });
  qc.invalidateQueries({ queryKey: ["politics", "rivals"] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  if (entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.revisions.forEntity(entityId) });
  }
}

export function useCreatePoliticalEntity() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewPoliticalEntity) => {
      beginSave();
      return api.politics.create(input);
    },
    onSuccess: (entity) => {
      resolveSave();
      invalidatePoliticsQueries(qc, entity.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdatePoliticalEntity() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PoliticalEntityPatch }) => {
      beginSave();
      return api.politics.update(id, patch);
    },
    onSuccess: (entity) => {
      resolveSave();
      qc.setQueryData(queryKeys.politics.detail(entity.id), entity);
      invalidatePoliticsQueries(qc, entity.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeletePoliticalEntity() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.politics.delete(id);
    },
    onSuccess: (_data, id) => {
      resolveSave();
      invalidatePoliticsQueries(qc, id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

/** Creates an `allied_with` or `rival_of` edge (FR3.1), rejected
 * server/mock-side on a duplicate-either-direction or a conflicting
 * opposite-type edge (FR3.2/FR3.3) -- see
 * politics::create_symmetric_edge in loreforge-core and
 * mockApi.politics.createSymmetricEdge in mockBackend.ts. */
export function useCreateSymmetricEdge() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({
      a,
      b,
      relationshipType,
    }: {
      a: string;
      b: string;
      relationshipType: string;
    }) => {
      beginSave();
      return api.politics.createSymmetricEdge(a, b, relationshipType);
    },
    onSuccess: (_relationship, variables) => {
      resolveSave();
      invalidatePoliticsQueries(qc, variables.a);
      invalidatePoliticsQueries(qc, variables.b);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
