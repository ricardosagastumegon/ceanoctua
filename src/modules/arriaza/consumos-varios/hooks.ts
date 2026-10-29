import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  attConsumosVariosApi,
  type AttConsumoVarios,
  type AttConsumoVariosInsert,
  type AttConsumoVariosUpdate,
} from './api';
import { invalidarViaje } from '../viajes/invalidar';

export const attConsumosVariosKey: QueryKey = ['att_consumos_varios'];
export function attConsumosVariosByViajeKey(viajeId: string): QueryKey {
  return ['att_consumos_varios', 'by_viaje', viajeId];
}

export function useAttConsumosVariosByViaje(viajeId: string | null | undefined) {
  return useQuery<AttConsumoVarios[], Error>({
    queryKey: attConsumosVariosByViajeKey(viajeId ?? ''),
    queryFn: () => attConsumosVariosApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttConsumoVarios() {
  const qc = useQueryClient();
  return useMutation<AttConsumoVarios, Error, AttConsumoVariosInsert>({
    mutationFn: (i) => attConsumosVariosApi.create(i),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: attConsumosVariosKey });
      void qc.invalidateQueries({ queryKey: attConsumosVariosByViajeKey(r.viaje_id) });
      invalidarViaje(qc, r.viaje_id);
    },
  });
}

export function useUpdateAttConsumoVarios() {
  const qc = useQueryClient();
  return useMutation<AttConsumoVarios, Error, { id: string; patch: AttConsumoVariosUpdate }>({
    mutationFn: ({ id, patch }) => attConsumosVariosApi.update(id, patch),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: attConsumosVariosKey });
      void qc.invalidateQueries({ queryKey: attConsumosVariosByViajeKey(r.viaje_id) });
      invalidarViaje(qc, r.viaje_id);
    },
  });
}

export function useDeleteAttConsumoVarios() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attConsumosVariosApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attConsumosVariosKey });
      void qc.invalidateQueries({ queryKey: attConsumosVariosByViajeKey(viajeId) });
      // Borrar cambia el total del viaje y su liquidación.
      invalidarViaje(qc, viajeId);
    },
  });
}
