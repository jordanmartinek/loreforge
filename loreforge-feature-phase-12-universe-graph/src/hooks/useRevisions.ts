import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";

/** Powers the reusable RevisionHistoryPanel (FR4.4) -- works identically
 * for any entity id, whether it belongs to a Character, Event, or Canon
 * Entry, since the underlying `revisions` table is polymorphic across
 * entity types (design-phase-3-canon.md section 1). */
export function useRevisionsForEntity(entityId: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: queryKeys.revisions.forEntity(entityId ?? ""),
    queryFn: () => api.revisions.listForEntity(entityId as string, limit),
    enabled: !!entityId,
  });
}
