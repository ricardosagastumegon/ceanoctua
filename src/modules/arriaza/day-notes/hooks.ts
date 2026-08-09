import { createCrudHooks } from '@/lib/createCrudHooks';
import { attDayNotesApi, type AttDayNote, type AttDayNoteInsert, type AttDayNoteUpdate } from './api';

export const {
  queryKey: attDayNotesKey,
  useList: useAttDayNotes,
  useCreate: useCreateAttDayNote,
  useUpdate: useUpdateAttDayNote,
  useDelete: useDeleteAttDayNote,
} = createCrudHooks<AttDayNote, AttDayNoteInsert, AttDayNoteUpdate>('att_day_notes', attDayNotesApi);
