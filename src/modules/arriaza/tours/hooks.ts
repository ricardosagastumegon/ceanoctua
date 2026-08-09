import { createCrudHooks } from '@/lib/createCrudHooks';
import { attToursApi, type AttTour, type AttTourInsert, type AttTourUpdate } from './api';

export const {
  queryKey: attToursKey,
  useList: useAttTours,
  useCreate: useCreateAttTour,
  useUpdate: useUpdateAttTour,
  useDelete: useDeleteAttTour,
} = createCrudHooks<AttTour, AttTourInsert, AttTourUpdate>('att_tours', attToursApi);
