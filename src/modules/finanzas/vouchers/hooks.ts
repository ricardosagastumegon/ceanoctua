import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vouchersApi, type VoucherInsert, type VoucherUpdate } from './api';

const keys = { all: ['vouchers'] as const };

export function useVouchers() {
  return useQuery({ queryKey: keys.all, queryFn: () => vouchersApi.list() });
}
export function useCreateVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VoucherInsert) => vouchersApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useUpdateVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: VoucherUpdate }) => vouchersApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
export function useDeleteVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vouchersApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
