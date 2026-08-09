import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attAcuaticosApi, type AttAcuatico, type AttAcuaticoInsert, type AttAcuaticoUpdate } from './api';

export const attAcuaticosKey: QueryKey = ['att_acuaticos'];
export function attAcuaticosByViajeKey(viajeId: string): QueryKey { return ['att_acuaticos', 'by_viaje', viajeId]; }

export function useAttAcuaticos() {
  return useQuery<AttAcuatico[], Error>({ queryKey: attAcuaticosKey, queryFn: () => attAcuaticosApi.list() });
}
export function useAttAcuaticosByViaje(viajeId: string | null | undefined) {
  return useQuery<AttAcuatico[], Error>({
    queryKey: attAcuaticosByViajeKey(viajeId ?? ''),
    queryFn: () => attAcuaticosApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}
export function useCreateAttAcuatico() {
  const qc = useQueryClient();
  return useMutation<AttAcuatico, Error, AttAcuaticoInsert>({
    mutationFn: (i) => attAcuaticosApi.create(i),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: attAcuaticosKey }); void qc.invalidateQueries({ queryKey: attAcuaticosByViajeKey(r.viaje_id) }); },
  });
}
export function useUpdateAttAcuatico() {
  const qc = useQueryClient();
  return useMutation<AttAcuatico, Error, { id: string; patch: AttAcuaticoUpdate }>({
    mutationFn: ({ id, patch }) => attAcuaticosApi.update(id, patch),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: attAcuaticosKey }); void qc.invalidateQueries({ queryKey: attAcuaticosByViajeKey(r.viaje_id) }); },
  });
}
export function useDeleteAttAcuatico() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attAcuaticosApi.remove(id),
    onSuccess: (_v, { viajeId }) => { void qc.invalidateQueries({ queryKey: attAcuaticosKey }); void qc.invalidateQueries({ queryKey: attAcuaticosByViajeKey(viajeId) }); },
  });
}
