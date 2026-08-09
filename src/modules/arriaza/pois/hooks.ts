import { createCrudHooks } from '@/lib/createCrudHooks';
import { attPoisApi, type AttPoi, type AttPoiInsert, type AttPoiUpdate } from './api';

export const {
  queryKey: attPoisKey,
  useList: useAttPois,
  useCreate: useCreateAttPoi,
  useUpdate: useUpdateAttPoi,
  useDelete: useDeleteAttPoi,
} = createCrudHooks<AttPoi, AttPoiInsert, AttPoiUpdate>('att_pois', attPoisApi);
