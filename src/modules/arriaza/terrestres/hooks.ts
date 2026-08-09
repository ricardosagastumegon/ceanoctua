import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attTerrestresApi, type AttTerrestre, type AttTerrestreInsert, type AttTerrestreUpdate } from './api';

export const attTerrestresKey: QueryKey = ['att_terrestres'];
export function attTerrestresByViajeKey(viajeId: string): QueryKey { return ['att_terrestres', 'by_viaje', viajeId]; }

export function useAttTerrestres() { return useQuery<AttTerrestre[], Error>({ queryKey: attTerrestresKey, queryFn: () => attTerrestresApi.list() }); }
export function useAttTerrestresByViaje(viajeId: string | null | undefined) {
  return useQuery<AttTerrestre[], Error>({ queryKey: attTerrestresByViajeKey(viajeId ?? ''), queryFn: () => attTerrestresApi.listByViaje(viajeId ?? ''), enabled: !!viajeId });
}
export function useCreateAttTerrestre() {
  const qc = useQueryClient();
  return useMutation<AttTerrestre, Error, AttTerrestreInsert>({
    mutationFn: (i) => attTerrestresApi.create(i),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: attTerrestresKey }); void qc.invalidateQueries({ queryKey: attTerrestresByViajeKey(r.viaje_id) }); },
  });
}
export function useUpdateAttTerrestre() {
  const qc = useQueryClient();
  return useMutation<AttTerrestre, Error, { id: string; patch: AttTerrestreUpdate }>({
    mutationFn: ({ id, patch }) => attTerrestresApi.update(id, patch),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: attTerrestresKey }); void qc.invalidateQueries({ queryKey: attTerrestresByViajeKey(r.viaje_id) }); },
  });
}
export function useDeleteAttTerrestre() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attTerrestresApi.remove(id),
    onSuccess: (_v, { viajeId }) => { void qc.invalidateQueries({ queryKey: attTerrestresKey }); void qc.invalidateQueries({ queryKey: attTerrestresByViajeKey(viajeId) }); },
  });
}
