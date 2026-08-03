import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { NewTechnology, TechnologyFilter, TechnologyPatch } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useTechnologies(filter: TechnologyFilter = {}) {
  return useQuery({
    queryKey: queryKeys.technologies.list(filter),
    queryFn: () => api.technologies.list(filter),
  });
}

export function useTechnology(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.technologies.detail(id ?? ""),
    queryFn: () => api.technologies.get(id as string),
    enabled: !!id,
  });
}

/** Powers TechnologyDependencies.tsx's prerequisites list (FR2.3). */
export function usePrerequisites(technologyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.technologies.prerequisites(technologyId ?? ""),
    queryFn: () => api.technologies.listPrerequisites(technologyId as string),
    enabled: !!technologyId,
  });
}

/** Powers TechnologyDependencies.tsx's read-only dependents list (FR2.3). */
export function useDependents(technologyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.technologies.dependents(technologyId ?? ""),
    queryFn: () => api.technologies.listDependents(technologyId as string),
    enabled: !!technologyId,
  });
}

function invalidateTechnologyQueries(qc: ReturnType<typeof useQueryClient>, entityId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.technologies.all });
  qc.invalidateQueries({ queryKey: ["technologies", "prerequisites"] });
  qc.invalidateQueries({ queryKey: ["technologies", "dependents"] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  if (entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.revisions.forEntity(entityId) });
  }
}

export function useCreateTechnology() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewTechnology) => {
      beginSave();
      return api.technologies.create(input);
    },
    onSuccess: (technology) => {
      resolveSave();
      invalidateTechnologyQueries(qc, technology.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateTechnology() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TechnologyPatch }) => {
      beginSave();
      return api.technologies.update(id, patch);
    },
    onSuccess: (technology) => {
      resolveSave();
      qc.setQueryData(queryKeys.technologies.detail(technology.id), technology);
      invalidateTechnologyQueries(qc, technology.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteTechnology() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.technologies.delete(id);
    },
    onSuccess: (_data, id) => {
      resolveSave();
      invalidateTechnologyQueries(qc, id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

/** Creates a `requires` edge (FR2.1), rejected server/mock-side if it would
 * introduce a cycle (FR2.2) -- see technologies::create_requires_edge in
 * loreforge-core and wouldCreateTechnologyCycle in mockBackend.ts. */
export function useCreateRequiresEdge() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({
      dependentId,
      prerequisiteId,
    }: {
      dependentId: string;
      prerequisiteId: string;
    }) => {
      beginSave();
      return api.technologies.createRequiresEdge(dependentId, prerequisiteId);
    },
    onSuccess: (_relationship, variables) => {
      resolveSave();
      invalidateTechnologyQueries(qc, variables.dependentId);
      invalidateTechnologyQueries(qc, variables.prerequisiteId);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
