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
// useAssignVale fue removida en Fase 17 · F-2 — el vínculo vale↔liquidación
// ahora vive en `liquidacion_vales` (M:N). Ver useReplaceLiqVales en
// modules/cc-board/liquidaciones/hooks.ts.
