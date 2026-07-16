import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { CharacterFilter, CharacterPatch, NewCharacter } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useCharacters(filter: CharacterFilter = {}) {
  return useQuery({
    queryKey: queryKeys.characters.list(filter),
    queryFn: () => api.characters.list(filter),
  });
}

export function useCharacter(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.characters.detail(id ?? ""),
    queryFn: () => api.characters.get(id as string),
    enabled: !!id,
  });
}

/** Invalidate every query that a character mutation could affect. */
function invalidateCharacterQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.characters.all });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewCharacter) => {
      beginSave();
      return api.characters.create(input);
    },
    onSuccess: () => {
      resolveSave();
      invalidateCharacterQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateCharacter() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CharacterPatch }) => {
      beginSave();
      return api.characters.update(id, patch);
    },
    onSuccess: (character) => {
      resolveSave();
      qc.setQueryData(queryKeys.characters.detail(character.id), character);
      invalidateCharacterQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.characters.delete(id);
    },
    onSuccess: () => {
      resolveSave();
      invalidateCharacterQueries(qc);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
