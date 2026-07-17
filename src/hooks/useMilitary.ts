import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { MilitaryUnitFilter, MilitaryUnitPatch, NewMilitaryUnit } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useMilitaryUnits(filter: MilitaryUnitFilter = {}) {
  return useQuery({
    queryKey: queryKeys.military.list(filter),
    queryFn: () => api.military.list(filter),
  });
}

export function useMilitaryUnit(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.military.detail(id ?? ""),
    queryFn: () => api.military.get(id as string),
    enabled: !!id,
  });
}

/** Powers MilitaryUnitDetail.tsx's read-only subordinate-units list
 * (FR2.2). Kept general (parentId: null fetches top-of-chain-of-command
 * units) for consistency with useSubspecies/useLocationChildren's shape,
 * even though there's no tree-navigation surface in this phase's UI. */
export function useSubordinateUnits(parentId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.military.subordinateUnits(parentId),
    queryFn: () => api.military.listSubordinateUnits(parentId),
    enabled,
  });
}

/** Invalidate every query a military unit mutation could affect. A unit
 * mutation can change the chain-of-command tree's shape
 * (create/delete/reparent), so this invalidates every subordinate-units
 * query rather than computing exactly which node(s) were affected --
 * same rationale as useSpecies.ts's invalidateSpeciesQueries. */
function invalidateMilitaryQueries(qc: ReturnType<typeof useQueryClient>, entityId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.military.all });
  qc.invalidateQueries({ queryKey: ["military", "subordinateUnits"] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  if (entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.revisions.forEntity(entityId) });
  }
}

export function useCreateMilitaryUnit() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewMilitaryUnit) => {
      beginSave();
      return api.military.create(input);
    },
    onSuccess: (unit) => {
      resolveSave();
      invalidateMilitaryQueries(qc, unit.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateMilitaryUnit() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MilitaryUnitPatch }) => {
      beginSave();
      return api.military.update(id, patch);
    },
    onSuccess: (unit) => {
      resolveSave();
      qc.setQueryData(queryKeys.military.detail(unit.id), unit);
      invalidateMilitaryQueries(qc, unit.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteMilitaryUnit() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.military.delete(id);
    },
    onSuccess: (_data, id) => {
      resolveSave();
      invalidateMilitaryQueries(qc, id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
