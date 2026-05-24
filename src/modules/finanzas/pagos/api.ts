import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Pago = Database['public']['Tables']['pagos']['Row'];
export type PagoInsert = Database['public']['Tables']['pagos']['Insert'];
export type PagoUpdate = Database['public']['Tables']['pagos']['Update'];

export const pagosApi = {
  async list(): Promise<Pago[]> {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: PagoInsert): Promise<Pago> {
    const { data, error } = await supabase.from('pagos').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: PagoUpdate): Promise<Pago> {
    const { data, error } = await supabase.from('pagos').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('pagos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};
