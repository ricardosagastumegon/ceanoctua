import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCrudHooks } from '@/lib/createCrudHooks';
import { ceaTodosApi } from './api';

const h = createCrudHooks('cea_todos', ceaTodosApi);

export const useCeaTodos = h.useList;
export const useCreateCeaTodo = h.useCreate;
export const useUpdateCeaTodo = h.useUpdate;
export const useDeleteCeaTodo = h.useDelete;

// Custom: toggle done — not part of the standard CRUD shape.
export function useToggleCeaTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => ceaTodosApi.toggleDone(id, done),
    onSuccess: () => void qc.invalidateQueries({ queryKey: h.queryKey }),
  });
}
