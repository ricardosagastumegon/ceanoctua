import { createCrudHooks } from '@/lib/createCrudHooks';
import { attFerriesApi, type AttFerry, type AttFerryInsert, type AttFerryUpdate } from './api';

export const {
  queryKey: attFerriesKey,
  useList: useAttFerries,
  useCreate: useCreateAttFerry,
  useUpdate: useUpdateAttFerry,
  useDelete: useDeleteAttFerry,
} = createCrudHooks<AttFerry, AttFerryInsert, AttFerryUpdate>('att_ferries', attFerriesApi);
