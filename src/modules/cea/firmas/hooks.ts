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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['firmas', 'pendientes'] });
    },
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

/**
 * Que documentos ya tienen una firma esperando.
 *
 * Sin esto el boton de pedir firma no sabe que ya la pidio, y cada clic crea
 * otra: en el tablero de quien firma aparecia el mismo documento dos veces.
 */
export function useFirmasPendientes() {
  return useQuery({
    queryKey: ['firmas', 'pendientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firmas')
        .select('id, pago_id, liquidacion_id')
        .eq('status_firma', 'en_espera')
        .is('deleted_at', null);
      if (error) throw error;
      const porPago = new Map<string, string>();
      const porLiquidacion = new Map<string, string>();
      for (const f of data ?? []) {
        if (f.pago_id) porPago.set(f.pago_id as string, f.id as string);
        if (f.liquidacion_id) porLiquidacion.set(f.liquidacion_id as string, f.id as string);
      }
      return { porPago, porLiquidacion };
    },
  });
}

/** Retirar una solicitud de firma que todavia no se firmo. */
export function useCancelarFirma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => firmasApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['firmas', 'pendientes'] });
      void qc.invalidateQueries({ queryKey: ['pagos', 'firma_counts'] });
    },
  });
}

export function useFirmarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => firmasApi.firmar(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['firmas', 'pendientes'] });
      // El paso del pago depende de sus firmas: si no se invalida, la
      // solicitud sigue diciendo que espera firma.
      void qc.invalidateQueries({ queryKey: ['pagos'] });
    },
  });
}

export function useDeleteFirma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => firmasApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
