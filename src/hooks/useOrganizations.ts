import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import type { NewOrganization, OrganizationFilter, OrganizationPatch } from "../lib/types";
import { useSaveStatusStore } from "../store/saveStatusStore";

export function useOrganizations(filter: OrganizationFilter = {}) {
  return useQuery({
    queryKey: queryKeys.organizations.list(filter),
    queryFn: () => api.organizations.list(filter),
  });
}

export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.detail(id ?? ""),
    queryFn: () => api.organizations.get(id as string),
    enabled: !!id,
  });
}

/** Powers OrganizationDetail.tsx's read-only subsidiaries list (FR3.2). */
export function useSubsidiaries(parentId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.organizations.subsidiaries(parentId),
    queryFn: () => api.organizations.listSubsidiaries(parentId),
    enabled,
  });
}

/** Powers OrgDiplomaticRelations.tsx's allies list (FR5.4), resolved
 * direction-agnostically -- see organizations::list_org_allies. */
export function useOrgAllies(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.allies(entityId ?? ""),
    queryFn: () => api.organizations.listAllies(entityId as string),
    enabled: !!entityId,
  });
}

/** Powers OrgDiplomaticRelations.tsx's rivals list (FR5.4). See
 * useOrgAllies. */
export function useOrgRivals(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.rivals(entityId ?? ""),
    queryFn: () => api.organizations.listRivals(entityId as string),
    enabled: !!entityId,
  });
}

function invalidateOrganizationQueries(qc: ReturnType<typeof useQueryClient>, entityId?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.organizations.all });
  qc.invalidateQueries({ queryKey: ["organizations", "subsidiaries"] });
  qc.invalidateQueries({ queryKey: ["organizations", "allies"] });
  qc.invalidateQueries({ queryKey: ["organizations", "rivals"] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.metrics });
  qc.invalidateQueries({ queryKey: queryKeys.relationships.all });
  if (entityId) {
    qc.invalidateQueries({ queryKey: queryKeys.revisions.forEntity(entityId) });
  }
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (input: NewOrganization) => {
      beginSave();
      return api.organizations.create(input);
    },
    onSuccess: (organization) => {
      resolveSave();
      invalidateOrganizationQueries(qc, organization.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: OrganizationPatch }) => {
      beginSave();
      return api.organizations.update(id, patch);
    },
    onSuccess: (organization) => {
      resolveSave();
      qc.setQueryData(queryKeys.organizations.detail(organization.id), organization);
      invalidateOrganizationQueries(qc, organization.id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  const { beginSave, resolveSave, failSave } = useSaveStatusStore();

  return useMutation({
    mutationFn: (id: string) => {
      beginSave();
      return api.organizations.delete(id);
    },
    onSuccess: (_data, id) => {
      resolveSave();
      invalidateOrganizationQueries(qc, id);
    },
    onError: (err: Error) => failSave(err.message),
  });
}

/** Creates an `org_allied_with` or `org_rival_of` edge (FR5.1), rejected
 * server/mock-side on a duplicate-either-direction or a conflicting
 * opposite-type edge (FR5.2/FR5.3). */
export function useCreateOrgSymmetricEdge() {
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
      return api.organizations.createSymmetricEdge(a, b, relationshipType);
    },
    onSuccess: (_relationship, variables) => {
      resolveSave();
      invalidateOrganizationQueries(qc, variables.a);
      invalidateOrganizationQueries(qc, variables.b);
    },
    onError: (err: Error) => failSave(err.message),
  });
}
