import { createCrudHooks } from '@/lib/createCrudHooks';
import { attRentasApi, type AttRenta, type AttRentaInsert, type AttRentaUpdate } from './api';

export const {
  queryKey: attRentasKey,
  useList: useAttRentas,
  useCreate: useCreateAttRenta,
  useUpdate: useUpdateAttRenta,
  useDelete: useDeleteAttRenta,
} = createCrudHooks<AttRenta, AttRentaInsert, AttRentaUpdate>('att_rentas', attRentasApi);
