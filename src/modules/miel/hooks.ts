import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mielApi, type ConstanciaInsert, type ConstanciaUpdate } from './api';

const keys = { all: ['miel_constancias'] as const };

export function useConstancias() {
  return useQuery({ queryKey: keys.all, queryFn: () => mielApi.list() });
}
export function useCreateConstancia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConstanciaInsert) => mielApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateConstancia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ConstanciaUpdate }) => mielApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteConstancia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mielApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
