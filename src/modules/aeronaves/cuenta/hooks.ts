import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { combustibleKey } from '../combustible/hooks';
import { cuentaApi } from './api';
import type { Database } from '@/types/database';

export const cuentaKey = (aeronaveId: string) => ['avn_fuel_cuenta', aeronaveId] as const;

export function useEstadoCuenta(aeronaveId: string | undefined) {
  return useQuery({
    queryKey: cuentaKey(aeronaveId ?? ''),
    enabled: !!aeronaveId,
    queryFn: () => cuentaApi.cargar(aeronaveId as string),
  });
}

/**
 * El estado de cuenta se alimenta de los registros de combustible, así que
 * cualquier cambio de un lado tiene que refrescar el otro.
 */
function useInvalidar(aeronaveId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: cuentaKey(aeronaveId) });
    void qc.invalidateQueries({ queryKey: combustibleKey(aeronaveId) });
  };
}

export function useGuardarAbono(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (v: Parameters<typeof cuentaApi.guardarAbono>[0]) => cuentaApi.guardarAbono(v),
    onSuccess: () => invalidar(),
  });
}

export function useBorrarAbono(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (id: string) => cuentaApi.borrarAbono(id),
    onSuccess: () => invalidar(),
  });
}

export function useGuardarCuenta(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (v: { id: string; patch: Database['public']['Tables']['avn_fuel_cuentas']['Update'] }) =>
      cuentaApi.guardarCuenta(v.id, v.patch),
    onSuccess: () => invalidar(),
  });
}
