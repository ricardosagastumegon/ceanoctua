import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { liquidacionesApi, type LiquidacionInsert, type LiquidacionUpdate } from './api';

const keys = {
  all: ['caja_chica_liquidaciones'] as const,
  vales: (liqId: string) => ['caja_chica_liquidaciones', liqId, 'vales'] as const,
};

export function useLiquidaciones() {
  return useQuery({ queryKey: keys.all, queryFn: () => liquidacionesApi.list() });
}
export function useValesByLiquidacion(liqId: string | undefined) {
  return useQuery({
    queryKey: liqId ? keys.vales(liqId) : ['noop'],
    queryFn: () => liquidacionesApi.listValesByLiquidacion(liqId as string),
    enabled: !!liqId,
  });
}
export function useCreateLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LiquidacionInsert) => liquidacionesApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LiquidacionUpdate }) => liquidacionesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => liquidacionesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
