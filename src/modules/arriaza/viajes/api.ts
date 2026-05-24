import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttViaje = Database['public']['Tables']['att_viajes']['Row'];
export type AttViajeInsert = Database['public']['Tables']['att_viajes']['Insert'];
export type AttViajeUpdate = Database['public']['Tables']['att_viajes']['Update'];

export const attViajesApi = {
  async list(): Promise<AttViaje[]> {
    const { data, error } = await supabase
      .from('att_viajes')
      .select('*')
      .order('fecha_ini', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async get(id: string): Promise<AttViaje | null> {
    const { data, error } = await supabase.from('att_viajes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async create(input: AttViajeInsert): Promise<AttViaje> {
    const { data, error } = await supabase.from('att_viajes').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: AttViajeUpdate): Promise<AttViaje> {
    const { data, error } = await supabase.from('att_viajes').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('att_viajes').delete().eq('id', id);
    if (error) throw error;
  },
};
