import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCrudHooks } from '@/lib/createCrudHooks';
import { reintegrosApi, type ReintegroInsert } from './api';

const h = createCrudHooks('reintegros', reintegrosApi);

export const useReintegros = h.useList;
export const useUpdateReintegro = h.useUpdate;
export const useDeleteReintegro = h.useDelete;

// Custom create: linking a reintegro to a consumo invalidates the consumo
// cache too, so the consumo row shows ✓ enlazado immediately.
export function useCreateReintegro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReintegroInsert) => reintegrosApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: h.queryKey });
      void qc.invalidateQueries({ queryKey: ['tc_consumos'] });
    },
  });
}
