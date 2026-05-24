import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventosApi, type EventoInsert, type EventoUpdate } from './api';

const keys = {
  list: (miembroId: string | undefined) => ['eventos', miembroId] as const,
};

export function useEventos(miembroId: string | undefined) {
  return useQuery({
    queryKey: keys.list(miembroId),
    queryFn: () => eventosApi.listByMiembro(miembroId as string),
    enabled: !!miembroId,
  });
}
export function useCreateEvento(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventoInsert) => eventosApi.create({ ...input, miembro_id: miembroId ?? null }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}
export function useUpdateEvento(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EventoUpdate }) => eventosApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}
export function useDeleteEvento(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventosApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.list(miembroId) }),
  });
}
