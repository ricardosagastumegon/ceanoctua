import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hotelesApi, type AttHotelInsert, type AttHotelUpdate } from './api';

const keys = { list: (viajeId: string | undefined) => ['att_hoteles', viajeId] as const };

export function useHoteles(viajeId: string | undefined) {
  return useQuery({
    queryKey: keys.list(viajeId),
    queryFn: () => hotelesApi.listByViaje(viajeId as string),
    enabled: !!viajeId,
  });
}
export function useCreateHotel(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttHotelInsert) => hotelesApi.create({ ...input, viaje_id: viajeId as string }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
export function useUpdateHotel(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AttHotelUpdate }) => hotelesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
export function useDeleteHotel(viajeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hotelesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(viajeId) }),
  });
}
