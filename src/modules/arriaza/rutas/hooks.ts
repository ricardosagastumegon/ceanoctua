import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attRutasApi, type AttRuta, type AttRutaInsert, type AttRutaUpdate } from './api';

export const attRutasKey: QueryKey = ['att_rutas'];
export function attRutasByViajeKey(viajeId: string): QueryKey {
  return ['att_rutas', 'by_viaje', viajeId];
}

export function useAttRutas() {
  return useQuery<AttRuta[], Error>({ queryKey: attRutasKey, queryFn: () => attRutasApi.list() });
}

export function useAttRutasByViaje(viajeId: string | null | undefined) {
  return useQuery<AttRuta[], Error>({
    queryKey: attRutasByViajeKey(viajeId ?? ''),
    queryFn: () => attRutasApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttRuta() {
  const qc = useQueryClient();
  return useMutation<AttRuta, Error, AttRutaInsert>({
    mutationFn: (input) => attRutasApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attRutasKey });
      void qc.invalidateQueries({ queryKey: attRutasByViajeKey(row.viaje_id) });
    },
  });
}

export function useUpdateAttRuta() {
  const qc = useQueryClient();
  return useMutation<AttRuta, Error, { id: string; patch: AttRutaUpdate }>({
    mutationFn: ({ id, patch }) => attRutasApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attRutasKey });
      void qc.invalidateQueries({ queryKey: attRutasByViajeKey(row.viaje_id) });
    },
  });
}

export function useDeleteAttRuta() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attRutasApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attRutasKey });
      void qc.invalidateQueries({ queryKey: attRutasByViajeKey(viajeId) });
    },
  });
}
