import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { CrudApi } from '@/lib/createCrudHooks';

export type AttDayNote = Database['public']['Tables']['att_day_notes']['Row'];
export type AttDayNoteInsert = Database['public']['Tables']['att_day_notes']['Insert'];
export type AttDayNoteUpdate = Database['public']['Tables']['att_day_notes']['Update'];

export const attDayNotesApi: CrudApi<AttDayNote, AttDayNoteInsert, AttDayNoteUpdate> & {
  listByViaje(viajeId: string): Promise<AttDayNote[]>;
} = {
  async list() {
    const { data, error } = await supabase
      .from('att_day_notes').select('*').is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async listByViaje(viajeId: string) {
    const { data, error } = await supabase
      .from('att_day_notes').select('*').eq('viaje_id', viajeId).is('deleted_at', null)
      .order('fecha', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async create(input) {
    const { data, error } = await supabase.from('att_day_notes').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id, patch) {
    const { data, error } = await supabase.from('att_day_notes').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id) {
    const { error } = await supabase.from('att_day_notes')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};
