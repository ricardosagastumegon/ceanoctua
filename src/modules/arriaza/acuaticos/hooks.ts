import { createCrudHooks } from '@/lib/createCrudHooks';
import { attAcuaticosApi, type AttAcuatico, type AttAcuaticoInsert, type AttAcuaticoUpdate } from './api';

export const {
  queryKey: attAcuaticosKey,
  useList: useAttAcuaticos,
  useCreate: useCreateAttAcuatico,
  useUpdate: useUpdateAttAcuatico,
  useDelete: useDeleteAttAcuatico,
} = createCrudHooks<AttAcuatico, AttAcuaticoInsert, AttAcuaticoUpdate>('att_acuaticos', attAcuaticosApi);
