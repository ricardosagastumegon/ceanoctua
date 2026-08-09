import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attRentasApi, type AttRenta, type AttRentaInsert, type AttRentaUpdate } from './api';

export const attRentasKey: QueryKey = ['att_rentas'];
export function attRentasByViajeKey(viajeId: string): QueryKey {
  return ['att_rentas', 'by_viaje', viajeId];
}

export function useAttRentas() {
  return useQuery<AttRenta[], Error>({ queryKey: attRentasKey, queryFn: () => attRentasApi.list() });
}

export function useAttRentasByViaje(viajeId: string | null | undefined) {
  return useQuery<AttRenta[], Error>({
    queryKey: attRentasByViajeKey(viajeId ?? ''),
    queryFn: () => attRentasApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttRenta() {
  const qc = useQueryClient();
  return useMutation<AttRenta, Error, AttRentaInsert>({
    mutationFn: (input) => attRentasApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attRentasKey });
      void qc.invalidateQueries({ queryKey: attRentasByViajeKey(row.viaje_id) });
    },
  });
}

export function useUpdateAttRenta() {
  const qc = useQueryClient();
  return useMutation<AttRenta, Error, { id: string; patch: AttRentaUpdate }>({
    mutationFn: ({ id, patch }) => attRentasApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attRentasKey });
      void qc.invalidateQueries({ queryKey: attRentasByViajeKey(row.viaje_id) });
    },
  });
}

export function useDeleteAttRenta() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attRentasApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attRentasKey });
      void qc.invalidateQueries({ queryKey: attRentasByViajeKey(viajeId) });
    },
  });
}
