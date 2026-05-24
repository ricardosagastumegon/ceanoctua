import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ceaTodosApi, type CeaTodoInsert, type CeaTodoUpdate } from './api';

const keys = { all: ['cea_todos'] as const };

export function useCeaTodos() {
  return useQuery({ queryKey: keys.all, queryFn: () => ceaTodosApi.list() });
}
export function useCreateCeaTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CeaTodoInsert) => ceaTodosApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateCeaTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CeaTodoUpdate }) => ceaTodosApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useToggleCeaTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => ceaTodosApi.toggleDone(id, done),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteCeaTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ceaTodosApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
