import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reintegrosApi, type ReintegroInsert, type ReintegroUpdate } from './api';

const keys = { all: ['reintegros'] as const };

export function useReintegros() {
  return useQuery({ queryKey: keys.all, queryFn: () => reintegrosApi.list() });
}
export function useCreateReintegro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReintegroInsert) => reintegrosApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['tc_consumos'] });
    },
  });
}
export function useUpdateReintegro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ReintegroUpdate }) => reintegrosApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteReintegro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reintegrosApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
