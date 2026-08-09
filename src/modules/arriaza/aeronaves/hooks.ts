import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attAeronavesApi, type AttAeronave, type AttAeronaveInsert, type AttAeronaveUpdate } from './api';

export const attAeronavesKey: QueryKey = ['att_aeronaves'];
export function attAeronavesByViajeKey(viajeId: string): QueryKey {
  return ['att_aeronaves', 'by_viaje', viajeId];
}

export function useAttAeronaves() {
  return useQuery<AttAeronave[], Error>({ queryKey: attAeronavesKey, queryFn: () => attAeronavesApi.list() });
}

export function useAttAeronavesByViaje(viajeId: string | null | undefined) {
  return useQuery<AttAeronave[], Error>({
    queryKey: attAeronavesByViajeKey(viajeId ?? ''),
    queryFn: () => attAeronavesApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttAeronave() {
  const qc = useQueryClient();
  return useMutation<AttAeronave, Error, AttAeronaveInsert>({
    mutationFn: (input) => attAeronavesApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attAeronavesKey });
      void qc.invalidateQueries({ queryKey: attAeronavesByViajeKey(row.viaje_id) });
    },
  });
}

export function useUpdateAttAeronave() {
  const qc = useQueryClient();
  return useMutation<AttAeronave, Error, { id: string; patch: AttAeronaveUpdate }>({
    mutationFn: ({ id, patch }) => attAeronavesApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attAeronavesKey });
      void qc.invalidateQueries({ queryKey: attAeronavesByViajeKey(row.viaje_id) });
    },
  });
}

export function useDeleteAttAeronave() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attAeronavesApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attAeronavesKey });
      void qc.invalidateQueries({ queryKey: attAeronavesByViajeKey(viajeId) });
    },
  });
}
