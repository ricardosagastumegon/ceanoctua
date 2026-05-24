import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { directorioApi, type DirectorioInsert, type DirectorioUpdate } from './api';

const keys = { all: ['directorio'] as const };

export function useDirectorio() {
  return useQuery({ queryKey: keys.all, queryFn: () => directorioApi.list() });
}
export function useCreateDirectorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DirectorioInsert) => directorioApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateDirectorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DirectorioUpdate }) => directorioApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteDirectorio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => directorioApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
