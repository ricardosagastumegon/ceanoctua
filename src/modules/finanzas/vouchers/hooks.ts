import { createCrudHooks } from '@/lib/createCrudHooks';
import { vouchersApi } from './api';

const h = createCrudHooks('vouchers', vouchersApi);

export const useVouchers = h.useList;
export const useCreateVoucher = h.useCreate;
export const useUpdateVoucher = h.useUpdate;
export const useDeleteVoucher = h.useDelete;
