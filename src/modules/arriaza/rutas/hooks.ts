import { createCrudHooks } from '@/lib/createCrudHooks';
import { attRutasApi, type AttRuta, type AttRutaInsert, type AttRutaUpdate } from './api';

export const {
  queryKey: attRutasKey,
  useList: useAttRutas,
  useCreate: useCreateAttRuta,
  useUpdate: useUpdateAttRuta,
  useDelete: useDeleteAttRuta,
} = createCrudHooks<AttRuta, AttRutaInsert, AttRutaUpdate>('att_rutas', attRutasApi);
