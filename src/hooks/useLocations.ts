import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { LocationFilter, LocationPatch, NewLocation } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useLocations(filter: LocationFilter = {}) {
  return useQuery({
    queryKey: queryKeys.locations.list(filter),
    queryFn: () => api.locations.list(filter),
  });
}

export function useLocation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.locations.detail(id ?? ""),
    queryFn: () => api.locations.get(id as string),
    enabled: !!id,
  });
}

/** Powers each WorldExplorerTree node's lazy children fetch (design-phase-
 * 4-locations.md section 3.1) -- only fetches when a node is expanded
 * (`enabled`), never the whole hierarchy at once. `parentId: null` fetches
 * root-level locations. */
export function useLocationChildren(parentId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.locations.children(parentId),
    queryFn: () => api.locations.listChildren(parentId),
    enabled,
  });
}

/** Powers LocationBreadcrumb.tsx. */
export function useLocationAncestry(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.locations.ancestry(id ?? ""),
    queryFn: () => api.locations.getAncestryChain(id as string),
    enabled: !!id,
  });
}

/** Invalidate every query a location mutation could affect. Unlike flat
 * entity types (Characters/Events/Canon), a location mutation can change
 * the *shape* of the tree (create/delete/reparent), so this also
 * invalidates every children/ancestry query rather than trying to compute
 * exactly which node(s) were affected -- the tree is not expected to be
 * large enough in this phase for a blanket invalidation to be costly, and
 * correctness (never showing a stale tree) matters more here than in a
 * flat list. */
function invalidateLocationQueries(qc: ReturnType<typeof useQueryClient>, entityId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.locations.all });
  qc.invalidateQueries({ queryKey: ["locations", "children"] });
  qc.invalidateQueries({ queryKey: ["locations", "ancestry"] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  if (entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.revisions.forEntity(entityId) });
  }
}

export function useCreateLocation() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewLocation) => {
      beginSave();
      return api.locations.create(input);
    },
    onSuccess: (location) => {
      resolveSave();
      invalidateLocationQueries(qc, location.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LocationPatch }) => {
      beginSave();
      return api.locations.update(id, patch);
    },
    onSuccess: (location) => {
      resolveSave();
      qc.setQueryData(queryKeys.locations.detail(location.id), location);
      invalidateLocationQueries(qc, location.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.locations.delete(id);
    },
    onSuccess: (_data, id) => {
      resolveSave();
      invalidateLocationQueries(qc, id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
