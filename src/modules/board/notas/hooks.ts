import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notasApi, type NotaInsert, type NotaUpdate } from './api';

const keys = {
  list: (miembroId: string | undefined) => ['notas', miembroId] as const,
};

export function useNotas(miembroId: string | undefined) {
  return useQuery({
    queryKey: keys.list(miembroId),
    queryFn: () => notasApi.listByMiembro(miembroId as string),
    enabled: !!miembroId,
  });
}
export function useCreateNota(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotaInsert) => notasApi.create({ ...input, miembro_id: miembroId ?? null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}
export function useUpdateNota(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NotaUpdate }) => notasApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}
export function useDeleteNota(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notasApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}
