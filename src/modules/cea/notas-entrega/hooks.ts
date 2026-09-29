import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notasEntregaApi, type NotaEntregaInsert, type NotaEntregaUpdate } from './api';

const keys = { all: ['cea_notas_entrega'] as const };

export function useNotasEntrega() {
  return useQuery({ queryKey: keys.all, queryFn: () => notasEntregaApi.list() });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: keys.all });
}

export function useCrearNotaEntrega() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (input: NotaEntregaInsert) => notasEntregaApi.create(input),
    onSuccess: () => invalidar(),
  });
}

export function useActualizarNotaEntrega() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { id: string; patch: NotaEntregaUpdate }) => notasEntregaApi.update(v.id, v.patch),
    onSuccess: () => invalidar(),
  });
}

export function useBorrarNotaEntrega() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => notasEntregaApi.remove(id),
    onSuccess: () => invalidar(),
  });
}
