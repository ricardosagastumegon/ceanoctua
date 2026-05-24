import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { entidadesApi, type EntidadInsert, type EntidadUpdate } from './api';

const keys = {
  all: ['entidades'] as const,
  detail: (id: string) => ['entidades', id] as const,
};

export function useEntidades() {
  return useQuery({
    queryKey: keys.all,
    queryFn: () => entidadesApi.list(),
  });
}

export function useCreateEntidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EntidadInsert) => entidadesApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useUpdateEntidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EntidadUpdate }) =>
      entidadesApi.update(id, patch),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.detail(vars.id) });
    },
  });
}

export function useDeleteEntidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entidadesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

// Realtime: any insert/update/delete on entidades invalidates the list.
// Requirement (Supabase Studio): Database -> Replication -> enable Realtime
// on the 'entidades' table. Without that, this is a no-op.
export function useEntidadesRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('public:entidades')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entidades' },
        () => {
          void qc.invalidateQueries({ queryKey: keys.all });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
