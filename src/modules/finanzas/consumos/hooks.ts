import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { consumosApi, type ConsumoInsert, type ConsumoUpdate } from './api';

const keys = { all: ['tc_consumos'] as const };

export function useConsumos() {
  return useQuery({ queryKey: keys.all, queryFn: () => consumosApi.list() });
}
export function useCreateConsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConsumoInsert) => consumosApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateConsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ConsumoUpdate }) => consumosApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteConsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => consumosApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
