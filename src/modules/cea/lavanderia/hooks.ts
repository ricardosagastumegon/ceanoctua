import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lavanderiaApi, type Lavanderia, type LavanderiaInsert, type LavanderiaUpdate } from './api';

const keys = { all: ['lavanderia'] as const };

export function useLavanderia() {
  return useQuery({ queryKey: keys.all, queryFn: () => lavanderiaApi.list() });
}
export function useCreateLavanderia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LavanderiaInsert) => lavanderiaApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateLavanderia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LavanderiaUpdate }) => lavanderiaApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteLavanderia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => lavanderiaApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useAdvanceLavanderia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, current }: { id: string; current: Lavanderia }) => lavanderiaApi.advanceStep(id, current),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
