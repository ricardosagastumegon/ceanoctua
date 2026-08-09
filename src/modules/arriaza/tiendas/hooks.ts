import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  attTiendasApi,
  type AttTienda,
  type AttTiendaInsert,
  type AttTiendaUpdate,
} from './api';

export const attTiendasKey: QueryKey = ['att_tiendas'];
export function attTiendasByViajeKey(viajeId: string): QueryKey {
  return ['att_tiendas', 'by_viaje', viajeId];
}

// Lista TODAS las tiendas (uso global, no común).
export function useAttTiendas() {
  return useQuery<AttTienda[], Error>({ queryKey: attTiendasKey, queryFn: () => attTiendasApi.list() });
}

// Lista tiendas de un viaje específico (uso primario en TripCard).
export function useAttTiendasByViaje(viajeId: string | null | undefined) {
  return useQuery<AttTienda[], Error>({
    queryKey: attTiendasByViajeKey(viajeId ?? ''),
    queryFn: () => attTiendasApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttTienda() {
  const qc = useQueryClient();
  return useMutation<AttTienda, Error, AttTiendaInsert>({
    mutationFn: (input) => attTiendasApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attTiendasKey });
      void qc.invalidateQueries({ queryKey: attTiendasByViajeKey(row.viaje_id) });
    },
  });
}

export function useUpdateAttTienda() {
  const qc = useQueryClient();
  return useMutation<AttTienda, Error, { id: string; patch: AttTiendaUpdate }>({
    mutationFn: ({ id, patch }) => attTiendasApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attTiendasKey });
      void qc.invalidateQueries({ queryKey: attTiendasByViajeKey(row.viaje_id) });
    },
  });
}

export function useDeleteAttTienda() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attTiendasApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attTiendasKey });
      void qc.invalidateQueries({ queryKey: attTiendasByViajeKey(viajeId) });
    },
  });
}
