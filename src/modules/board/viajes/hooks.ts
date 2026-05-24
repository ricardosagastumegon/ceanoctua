import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { viajesApi, type ViajeInsert, type ViajeUpdate } from './api';

const keys = {
  list: (miembroId: string | undefined) => ['viajes', miembroId] as const,
  all: ['viajes', 'all'] as const,
  checklist: (viajeId: string | undefined) => ['viaje_checklist', viajeId] as const,
};

export function useViajes(miembroId: string | undefined) {
  return useQuery({
    queryKey: keys.list(miembroId),
    queryFn: () => viajesApi.listByMiembro(miembroId as string),
    enabled: !!miembroId,
  });
}

export function useAllViajes() {
  return useQuery({ queryKey: keys.all, queryFn: () => viajesApi.listAll() });
}

export function useCreateViaje(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ViajeInsert) => viajesApi.create({ ...input, miembro_id: miembroId ?? null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}

export function useUpdateViaje(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ViajeUpdate }) => viajesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}

export function useDeleteViaje(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => viajesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}

export function useChecklist(viajeId: string | undefined) {
  return useQuery({
    queryKey: keys.checklist(viajeId),
    queryFn: () => viajesApi.listChecklist(viajeId as string),
    enabled: !!viajeId,
  });
}

export function useToggleChecklist(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => viajesApi.toggleChecklistItem(id, done),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.checklist(viajeId) }),
  });
}

export function useAddChecklistItem(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: string) => viajesApi.addChecklistItem(viajeId as string, item),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.checklist(viajeId) }),
  });
}

export function useRemoveChecklistItem(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => viajesApi.removeChecklistItem(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.checklist(viajeId) }),
  });
}
