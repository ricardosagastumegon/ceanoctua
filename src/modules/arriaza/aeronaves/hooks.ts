import { createCrudHooks } from '@/lib/createCrudHooks';
import { attAeronavesApi, type AttAeronave, type AttAeronaveInsert, type AttAeronaveUpdate } from './api';

export const {
  queryKey: attAeronavesKey,
  useList: useAttAeronaves,
  useCreate: useCreateAttAeronave,
  useUpdate: useUpdateAttAeronave,
  useDelete: useDeleteAttAeronave,
} = createCrudHooks<AttAeronave, AttAeronaveInsert, AttAeronaveUpdate>('att_aeronaves', attAeronavesApi);
