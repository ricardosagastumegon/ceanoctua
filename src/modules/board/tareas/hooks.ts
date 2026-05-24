import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tareasApi, type TareaInsert, type TareaUpdate } from './api';

const keys = {
  list: (miembroId: string | undefined) => ['tareas', miembroId] as const,
};

export function useTareas(miembroId: string | undefined) {
  return useQuery({
    queryKey: keys.list(miembroId),
    queryFn: () => tareasApi.listByMiembro(miembroId as string),
    enabled: !!miembroId,
  });
}

export function useCreateTarea(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TareaInsert) => tareasApi.create({ ...input, miembro_id: miembroId ?? null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}

export function useUpdateTarea(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TareaUpdate }) => tareasApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}

export function useToggleTarea(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => tareasApi.toggleDone(id, done),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}

export function useDeleteTarea(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tareasApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}
