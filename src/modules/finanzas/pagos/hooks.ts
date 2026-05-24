import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pagosApi, type Pago, type PagoInsert, type PagoUpdate } from './api';

const keys = { all: ['pagos'] as const };

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
export function useUploadPagoComprobante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => pagosApi.uploadComprobante(id, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
