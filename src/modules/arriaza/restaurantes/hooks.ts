import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { restaurantesApi, type AttRestauranteInsert, type AttRestauranteUpdate } from './api';

const keys = { list: (viajeId: string | undefined) => ['att_restaurantes', viajeId] as const };

export function useRestaurantes(viajeId: string | undefined) {
  return useQuery({
    queryKey: keys.list(viajeId),
    queryFn: () => restaurantesApi.listByViaje(viajeId as string),
    enabled: !!viajeId,
  });
}
export function useCreateRestaurante(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttRestauranteInsert) =>
      restaurantesApi.create({ ...input, viaje_id: viajeId as string }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
export function useUpdateRestaurante(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AttRestauranteUpdate }) =>
      restaurantesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
export function useDeleteRestaurante(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restaurantesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
