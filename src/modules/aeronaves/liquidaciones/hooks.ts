import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  liquidacionesApi,
  type GastoInsert, type LiquidacionInsert, type LiquidacionUpdate,
} from './api';

const K = {
  lista: ['avn_liquidaciones'] as const,
  una: (id: string) => ['avn_liquidaciones', id] as const,
  gastos: (id: string) => ['avn_liquidaciones', id, 'gastos'] as const,
  adjuntos: (id: string) => ['avn_liquidaciones', id, 'adjuntos'] as const,
  pilotos: ['avn_pilotos', 'activos'] as const,
  aeronaves: ['avn_aeronaves', 'lista'] as const,
  vales: (aeronaveId: string) => ['avn_combustible_registros', aeronaveId] as const,
};

export function useLiquidaciones() {
  return useQuery({ queryKey: K.lista, queryFn: liquidacionesApi.lista });
}

export function useLiquidacion(id: string | undefined) {
  return useQuery({
    queryKey: K.una(id ?? ''),
    queryFn: () => liquidacionesApi.una(id as string),
    enabled: !!id,
  });
}

export function useGastos(id: string | undefined) {
  return useQuery({
    queryKey: K.gastos(id ?? ''),
    queryFn: () => liquidacionesApi.gastos(id as string),
    enabled: !!id,
  });
}

/** Cuántos adjuntos tiene cada gasto de esta liquidación. */
export function useAdjuntos(id: string | undefined, gastoIds: string[]) {
  return useQuery({
    queryKey: [...K.adjuntos(id ?? ''), gastoIds.length],
    queryFn: () => liquidacionesApi.adjuntos(gastoIds),
    enabled: !!id && gastoIds.length > 0,
  });
}

export function usePilotosActivos() {
  return useQuery({
    queryKey: K.pilotos,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avn_pilotos')
        .select('id, nombre, activo')
        .is('deleted_at', null)
        .order('nombre');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAeronavesSimples() {
  return useQuery({
    queryKey: K.aeronaves,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avn_aeronaves')
        .select('id, matricula, acento')
        .order('matricula');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useValesDe(aeronaveId: string | undefined) {
  return useQuery({
    queryKey: K.vales(aeronaveId ?? ''),
    queryFn: () => liquidacionesApi.valesDe(aeronaveId as string),
    enabled: !!aeronaveId,
  });
}

/**
 * Todo lo que toca una liquidación invalida lo mismo: la lista --porque los
 * totales y el estado se ven ahí-- y el detalle. Tenerlo en un solo sitio
 * evita la pantalla que se queda enseñando el total de antes.
 */
function useInvalidar(liquidacionId?: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: K.lista });
    if (liquidacionId) {
      void qc.invalidateQueries({ queryKey: K.una(liquidacionId) });
      void qc.invalidateQueries({ queryKey: K.gastos(liquidacionId) });
      void qc.invalidateQueries({ queryKey: ['avn_liquidaciones', liquidacionId, 'adjuntos'] });
    }
  };
}

export function useCrearLiquidacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (datos: LiquidacionInsert) => liquidacionesApi.crear(datos),
    onSuccess: invalidar,
  });
}

export function useActualizarLiquidacion(id: string) {
  const invalidar = useInvalidar(id);
  return useMutation({
    mutationFn: (datos: LiquidacionUpdate) => liquidacionesApi.actualizar(id, datos),
    onSuccess: invalidar,
  });
}

export function useBorrarLiquidacion() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => liquidacionesApi.borrar(id),
    onSuccess: invalidar,
  });
}

export function useGuardarGasto(liquidacionId: string) {
  const invalidar = useInvalidar(liquidacionId);
  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: GastoInsert }) =>
      liquidacionesApi.guardarGasto(id, datos),
    onSuccess: invalidar,
  });
}

export function useBorrarGasto(liquidacionId: string) {
  const invalidar = useInvalidar(liquidacionId);
  return useMutation({
    mutationFn: (id: string) => liquidacionesApi.borrarGasto(id),
    onSuccess: invalidar,
  });
}

export function useCerrar(liquidacionId: string) {
  const invalidar = useInvalidar(liquidacionId);
  return useMutation({
    mutationFn: () => liquidacionesApi.cerrar(liquidacionId),
    onSuccess: invalidar,
  });
}

export function useReabrir(liquidacionId: string) {
  const invalidar = useInvalidar(liquidacionId);
  return useMutation({
    mutationFn: () => liquidacionesApi.reabrir(liquidacionId),
    onSuccess: invalidar,
  });
}
