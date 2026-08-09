import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attFerriesApi, type AttFerry, type AttFerryInsert, type AttFerryUpdate } from './api';

export const attFerriesKey: QueryKey = ['att_ferries'];
export function attFerriesByViajeKey(viajeId: string): QueryKey { return ['att_ferries', 'by_viaje', viajeId]; }

export function useAttFerries() { return useQuery<AttFerry[], Error>({ queryKey: attFerriesKey, queryFn: () => attFerriesApi.list() }); }
export function useAttFerriesByViaje(viajeId: string | null | undefined) {
  return useQuery<AttFerry[], Error>({ queryKey: attFerriesByViajeKey(viajeId ?? ''), queryFn: () => attFerriesApi.listByViaje(viajeId ?? ''), enabled: !!viajeId });
}
export function useCreateAttFerry() {
  const qc = useQueryClient();
  return useMutation<AttFerry, Error, AttFerryInsert>({
    mutationFn: (i) => attFerriesApi.create(i),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: attFerriesKey }); void qc.invalidateQueries({ queryKey: attFerriesByViajeKey(r.viaje_id) }); },
  });
}
export function useUpdateAttFerry() {
  const qc = useQueryClient();
  return useMutation<AttFerry, Error, { id: string; patch: AttFerryUpdate }>({
    mutationFn: ({ id, patch }) => attFerriesApi.update(id, patch),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: attFerriesKey }); void qc.invalidateQueries({ queryKey: attFerriesByViajeKey(r.viaje_id) }); },
  });
}
export function useDeleteAttFerry() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attFerriesApi.remove(id),
    onSuccess: (_v, { viajeId }) => { void qc.invalidateQueries({ queryKey: attFerriesKey }); void qc.invalidateQueries({ queryKey: attFerriesByViajeKey(viajeId) }); },
  });
}
