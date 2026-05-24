import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attViajesApi, type AttViajeInsert, type AttViajeUpdate } from './api';

const keys = {
  all: ['att_viajes'] as const,
  detail: (id: string) => ['att_viajes', id] as const,
};

export function useAttViajes() {
  return useQuery({ queryKey: keys.all, queryFn: () => attViajesApi.list() });
}
export function useAttViaje(id: string | undefined) {
  return useQuery({
    queryKey: id ? keys.detail(id) : ['att_viajes', 'none'],
    queryFn: () => attViajesApi.get(id as string),
    enabled: !!id,
  });
}
export function useCreateAttViaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttViajeInsert) => attViajesApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateAttViaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AttViajeUpdate }) => attViajesApi.update(id, patch),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.detail(vars.id) });
    },
  });
}
export function useDeleteAttViaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attViajesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
