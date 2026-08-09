import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attPoisApi, type AttPoi, type AttPoiInsert, type AttPoiUpdate } from './api';

export const attPoisKey: QueryKey = ['att_pois'];
export function attPoisByViajeKey(viajeId: string): QueryKey {
  return ['att_pois', 'by_viaje', viajeId];
}

export function useAttPois() {
  return useQuery<AttPoi[], Error>({ queryKey: attPoisKey, queryFn: () => attPoisApi.list() });
}

export function useAttPoisByViaje(viajeId: string | null | undefined) {
  return useQuery<AttPoi[], Error>({
    queryKey: attPoisByViajeKey(viajeId ?? ''),
    queryFn: () => attPoisApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttPoi() {
  const qc = useQueryClient();
  return useMutation<AttPoi, Error, AttPoiInsert>({
    mutationFn: (input) => attPoisApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attPoisKey });
      void qc.invalidateQueries({ queryKey: attPoisByViajeKey(row.viaje_id) });
    },
  });
}

export function useUpdateAttPoi() {
  const qc = useQueryClient();
  return useMutation<AttPoi, Error, { id: string; patch: AttPoiUpdate }>({
    mutationFn: ({ id, patch }) => attPoisApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attPoisKey });
      void qc.invalidateQueries({ queryKey: attPoisByViajeKey(row.viaje_id) });
    },
  });
}

export function useDeleteAttPoi() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attPoisApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attPoisKey });
      void qc.invalidateQueries({ queryKey: attPoisByViajeKey(viajeId) });
    },
  });
}
