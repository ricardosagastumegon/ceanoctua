import { createCrudHooks } from '@/lib/createCrudHooks';
import { directorioApi } from './api';

const h = createCrudHooks('directorio', directorioApi);

export const useDirectorio = h.useList;
export const useCreateDirectorio = h.useCreate;
export const useUpdateDirectorio = h.useUpdate;
export const useDeleteDirectorio = h.useDelete;
