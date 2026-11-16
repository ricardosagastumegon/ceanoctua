import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { pagosApi, type Pago, type PagoInsert, type PagoUpdate } from './api';

const keys = { all: ['pagos'] as const };

/** Una solicitud anterior en la cadena, tal como la lista la base. */
export type EslabonSP = {
  id: string;
  serial: string | null;
  fecha: string;
  monto: number;
  moneda: string;
  status: string;
  cotizacion: number | null;
  nivel: number;
};

/**
 * Las solicitudes que esta continua, de la mas reciente a la mas vieja.
 *
 * De aqui sale «anticipos previos» del formato oficial: la SUMA de la cadena.
 * No se teclea en ningun lado, asi que no puede contradecir a la SP de la que
 * sale --que es justo lo que le paso al `pct_anticipo`, mal en 2 de 14 porque
 * era un numero escrito a mano que duplicaba `monto / cotizacion`.
 *
 * La funcion se niega a quien no puede ver la SP raiz, asi que para quien
 * firma --que no lee `pagos` suelto-- devuelve vacio y no error.
 */
export function useCadenaSP(pagoId: string | null | undefined) {
  return useQuery({
    queryKey: ['pagos', 'cadena', pagoId],
    enabled: !!pagoId,
    queryFn: async (): Promise<EslabonSP[]> => {
      const { data, error } = await supabase.rpc('pago_cadena', { p_pago: pagoId as string });
      if (error) throw error;
      return (data ?? []) as EslabonSP[];
    },
  });
}

/** Lo ya solicitado antes de esta hoja. Cero si no continua a ninguna. */
export function sumaDeLaCadena(eslabones: EslabonSP[] | undefined): number {
  return (eslabones ?? []).reduce((a, e) => a + Number(e.monto ?? 0), 0);
}

export function usePagos() {
  return useQuery({ queryKey: keys.all, queryFn: () => pagosApi.list() });
}
export function useCreatePago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PagoInsert) => pagosApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdatePago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PagoUpdate }) => pagosApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeletePago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pagosApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useAdvancePago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, current }: { id: string; current: Pago }) => pagosApi.advanceStep(id, current),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
/** Un paso atras. Solo lo ve el admin, y la funcion lo vuelve a comprobar. */
export function useStepBackPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pagosApi.stepBack(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUploadPagoComprobante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => pagosApi.uploadComprobante(id, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
