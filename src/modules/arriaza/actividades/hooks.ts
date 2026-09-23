import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { createCrudHooks } from '@/lib/createCrudHooks';
import {
  attActividadesApi,
  type AttActividad,
  type AttActividadInsert,
  type AttActividadUpdate,
} from './api';

// Padre: att_actividades (CRUD estándar).
export const {
  queryKey: attActividadesKey,
  useList: useAttActividades,
  useCreate: useCreateAttActividad,
  useUpdate: useUpdateAttActividad,
  useDelete: useDeleteAttActividad,
} = createCrudHooks<AttActividad, AttActividadInsert, AttActividadUpdate>('att_actividades', attActividadesApi);

// Por viaje · es como la pantalla del viaje pide sus actividades.
export function attActividadesByViajeKey(viajeId: string): QueryKey {
  return ['att_actividades', 'by_viaje', viajeId];
}

export function useAttActividadesByViaje(viajeId: string | null | undefined) {
  return useQuery<AttActividad[], Error>({
    queryKey: attActividadesByViajeKey(viajeId ?? ''),
    queryFn: () => attActividadesApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

/**
 * Borrado suave que además refresca la lista del viaje. El `useDelete`
 * genérico solo conoce la lista global.
 */
export function useDeleteAttActividadDelViaje() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attActividadesApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attActividadesKey });
      void qc.invalidateQueries({ queryKey: attActividadesByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: ['att_service_counts', viajeId] });
      void qc.invalidateQueries({ queryKey: ['att_itinerary_events', viajeId] });
    },
  });
}
