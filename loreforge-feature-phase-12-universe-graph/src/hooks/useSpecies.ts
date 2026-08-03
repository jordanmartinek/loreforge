import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { NewSpecies, SpeciesFilter, SpeciesPatch } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useSpeciesList(filter: SpeciesFilter = {}) {
  return useQuery({
    queryKey: queryKeys.species.list(filter),
    queryFn: () => api.species.list(filter),
  });
}

export function useSpeciesEntry(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.species.detail(id ?? ""),
    queryFn: () => api.species.get(id as string),
    enabled: !!id,
  });
}

/** Powers SpeciesDetail.tsx's read-only subspecies list (FR2.2). `parentId:
 * null` fetches root-level species -- not used by the current UI (there's
 * no tree-navigation surface, per design-phase-6-species.md section 3.1),
 * but kept general for consistency with useLocationChildren's shape. */
export function useSubspecies(parentId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.species.subspecies(parentId),
    queryFn: () => api.species.listSubspecies(parentId),
    enabled,
  });
}

/** Invalidate every query a species mutation could affect. A species
 * mutation can change the taxonomy tree's shape (create/delete/reparent),
 * so this invalidates every subspecies query rather than computing exactly
 * which node(s) were affected -- same rationale as
 * useLocations.ts's invalidateLocationQueries. */
function invalidateSpeciesQueries(qc: ReturnType<typeof useQueryClient>, entityId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.species.all });
  qc.invalidateQueries({ queryKey: ["species", "subspecies"] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  if (entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.revisions.forEntity(entityId) });
  }
}

export function useCreateSpecies() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewSpecies) => {
      beginSave();
      return api.species.create(input);
    },
    onSuccess: (species) => {
      resolveSave();
      invalidateSpeciesQueries(qc, species.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateSpecies() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SpeciesPatch }) => {
      beginSave();
      return api.species.update(id, patch);
    },
    onSuccess: (species) => {
      resolveSave();
      qc.setQueryData(queryKeys.species.detail(species.id), species);
      invalidateSpeciesQueries(qc, species.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteSpecies() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.species.delete(id);
    },
    onSuccess: (_data, id) => {
      resolveSave();
      invalidateSpeciesQueries(qc, id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
