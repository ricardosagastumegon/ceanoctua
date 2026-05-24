import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Lavanderia = Database['public']['Tables']['lavanderia']['Row'];
export type LavanderiaInsert = Database['public']['Tables']['lavanderia']['Insert'];
export type LavanderiaUpdate = Database['public']['Tables']['lavanderia']['Update'];

export const LAV_STEPS = [
  'Recibido',
  'En espera de Lavandería',
  'Entregado a Lavandería',
  'Recibido de Lavandería',
  'Entregado a Solicitante',
] as const;

export const lavanderiaApi = {
  async list(): Promise<Lavanderia[]> {
    const { data, error } = await supabase
      .from('lavanderia')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: LavanderiaInsert): Promise<Lavanderia> {
    const { data, error } = await supabase.from('lavanderia').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: LavanderiaUpdate): Promise<Lavanderia> {
    const { data, error } = await supabase.from('lavanderia').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('lavanderia')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
  async advanceStep(id: string, current: Lavanderia): Promise<Lavanderia> {
    if (current.step_idx >= LAV_STEPS.length - 1) return current;
    const next = current.step_idx + 1;
    const dates = [...(current.step_dates ?? [])];
    dates[next] = new Date().toISOString().slice(0, 10);
    return this.update(id, { step_idx: next, step_dates: dates });
  },
};
