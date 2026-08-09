import { createCrudHooks } from '@/lib/createCrudHooks';
import { attTerrestresApi, type AttTerrestre, type AttTerrestreInsert, type AttTerrestreUpdate } from './api';

export const {
  queryKey: attTerrestresKey,
  useList: useAttTerrestres,
  useCreate: useCreateAttTerrestre,
  useUpdate: useUpdateAttTerrestre,
  useDelete: useDeleteAttTerrestre,
} = createCrudHooks<AttTerrestre, AttTerrestreInsert, AttTerrestreUpdate>('att_terrestres', attTerrestresApi);
