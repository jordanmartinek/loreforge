import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { NewReligion, ReligionFilter, ReligionPatch } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useReligions(filter: ReligionFilter = {}) {
  return useQuery({
    queryKey: queryKeys.religions.list(filter),
    queryFn: () => api.religions.list(filter),
  });
}

export function useReligion(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.religions.detail(id ?? ""),
    queryFn: () => api.religions.get(id as string),
    enabled: !!id,
  });
}

/** Powers ReligionDetail.tsx's read-only schisms list (FR3.2). */
export function useSchisms(parentId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.religions.schisms(parentId),
    queryFn: () => api.religions.listSchisms(parentId),
    enabled,
  });
}

function invalidateReligionQueries(qc: ReturnType<typeof useQueryClient>, entityId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.religions.all });
  qc.invalidateQueries({ queryKey: ["religions", "schisms"] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  if (entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.revisions.forEntity(entityId) });
  }
}

export function useCreateReligion() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewReligion) => {
      beginSave();
      return api.religions.create(input);
    },
    onSuccess: (religion) => {
      resolveSave();
      invalidateReligionQueries(qc, religion.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateReligion() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ReligionPatch }) => {
      beginSave();
      return api.religions.update(id, patch);
    },
    onSuccess: (religion) => {
      resolveSave();
      qc.setQueryData(queryKeys.religions.detail(religion.id), religion);
      invalidateReligionQueries(qc, religion.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteReligion() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.religions.delete(id);
    },
    onSuccess: (_data, id) => {
      resolveSave();
      invalidateReligionQueries(qc, id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
