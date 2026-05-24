import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { valesApi, type ValeInsert, type ValeUpdate } from './api';

const keys = { all: ['caja_chica_vales'] as const };

export function useVales() {
  return useQuery({ queryKey: keys.all, queryFn: () => valesApi.list() });
}
export function useCreateVale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ValeInsert) => valesApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateVale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ValeUpdate }) => valesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteVale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => valesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useAssignVale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ valeId, liquidacionId }: { valeId: string; liquidacionId: string | null }) =>
      valesApi.assignToLiquidacion(valeId, liquidacionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['caja_chica_liquidaciones'] });
    },
  });
}
