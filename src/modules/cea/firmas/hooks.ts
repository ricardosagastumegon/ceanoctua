import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { firmasApi, type FirmaInsert, type FirmaUpdate } from './api';

const keys = {
  all: ['firmas'] as const,
  miembros: ['miembros_board', 'for-firmas'] as const,
};

export function useFirmas() {
  return useQuery({ queryKey: keys.all, queryFn: () => firmasApi.list() });
}

export function useBoardMiembros() {
  return useQuery({
    queryKey: keys.miembros,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('miembros_board')
        .select('id, codigo, nombre, orden')
        .order('orden', { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateFirma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, miembroIds }: { input: FirmaInsert; miembroIds: string[] }) =>
      firmasApi.create(input, miembroIds),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateFirma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch, miembroIds }: { id: string; patch: FirmaUpdate; miembroIds: string[] }) =>
      firmasApi.update(id, patch, miembroIds),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteFirma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => firmasApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
