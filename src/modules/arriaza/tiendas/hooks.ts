import { createCrudHooks } from '@/lib/createCrudHooks';
import { attTiendasApi, type AttTienda, type AttTiendaInsert, type AttTiendaUpdate } from './api';

export const {
  queryKey: attTiendasKey,
  useList: useAttTiendas,
  useCreate: useCreateAttTienda,
  useUpdate: useUpdateAttTienda,
  useDelete: useDeleteAttTienda,
} = createCrudHooks<AttTienda, AttTiendaInsert, AttTiendaUpdate>('att_tiendas', attTiendasApi);
