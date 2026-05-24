import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Constancia = Database['public']['Tables']['miel_constancias']['Row'];
export type ConstanciaInsert = Database['public']['Tables']['miel_constancias']['Insert'];
export type ConstanciaUpdate = Database['public']['Tables']['miel_constancias']['Update'];

export const mielApi = {
  async list(): Promise<Constancia[]> {
    const { data, error } = await supabase
      .from('miel_constancias')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false, nullsFirst: false })
      .order('correlativo', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: ConstanciaInsert): Promise<Constancia> {
    // Do not send correlativo — server default 'MSJ-####' from seq_miel_corr.
    const { correlativo: _ignored, ...rest } = input;
    void _ignored;
    const { data, error } = await supabase
      .from('miel_constancias')
      .insert(rest)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: ConstanciaUpdate): Promise<Constancia> {
    const { data, error } = await supabase
      .from('miel_constancias')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    // Soft delete to preserve correlativos
    const { error } = await supabase
      .from('miel_constancias')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
