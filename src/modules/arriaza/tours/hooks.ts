import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attToursApi, type AttTour, type AttTourInsert, type AttTourUpdate } from './api';

export const attToursKey: QueryKey = ['att_tours'];
export function attToursByViajeKey(viajeId: string): QueryKey {
  return ['att_tours', 'by_viaje', viajeId];
}

export function useAttTours() {
  return useQuery<AttTour[], Error>({ queryKey: attToursKey, queryFn: () => attToursApi.list() });
}

export function useAttToursByViaje(viajeId: string | null | undefined) {
  return useQuery<AttTour[], Error>({
    queryKey: attToursByViajeKey(viajeId ?? ''),
    queryFn: () => attToursApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttTour() {
  const qc = useQueryClient();
  return useMutation<AttTour, Error, AttTourInsert>({
    mutationFn: (input) => attToursApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attToursKey });
      void qc.invalidateQueries({ queryKey: attToursByViajeKey(row.viaje_id) });
    },
  });
}

export function useUpdateAttTour() {
  const qc = useQueryClient();
  return useMutation<AttTour, Error, { id: string; patch: AttTourUpdate }>({
    mutationFn: ({ id, patch }) => attToursApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attToursKey });
      void qc.invalidateQueries({ queryKey: attToursByViajeKey(row.viaje_id) });
    },
  });
}

export function useDeleteAttTour() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attToursApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attToursKey });
      void qc.invalidateQueries({ queryKey: attToursByViajeKey(viajeId) });
    },
  });
}
