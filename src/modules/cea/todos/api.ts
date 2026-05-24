import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type CeaTodo = Database['public']['Tables']['cea_todos']['Row'];
export type CeaTodoInsert = Database['public']['Tables']['cea_todos']['Insert'];
export type CeaTodoUpdate = Database['public']['Tables']['cea_todos']['Update'];

// Labels extendidos del HTML original (no son enum en DB — texto libre validado en UI).
export const CEA_TODO_PRIORIDADES = ['Baja', 'Media', 'Alta', 'Hold', 'TKIM'] as const;
export const CEA_TODO_ESTADOS = [
  'Comentado',
  'Solicitado',
  'Planeado',
  'Ejecutado',
  'HOLD',
  'Descartado',
  'Finalizado',
] as const;

export const CEA_TODO_PRI_COLOR: Record<string, string> = {
  Alta: 'bg-rust text-white',
  Media: 'bg-gold-light text-gold',
  Baja: 'bg-teal-l text-teal-d',
  Hold: 'bg-blue-light text-blue',
  TKIM: 'bg-dark text-white',
};

export const CEA_TODO_ESTADO_COLOR: Record<string, string> = {
  Comentado: 'bg-blue-light text-blue',
  Solicitado: 'bg-gold-light text-gold',
  Planeado: 'bg-teal-l text-teal-d',
  Ejecutado: 'bg-teal text-white',
  HOLD: 'bg-rust-l text-rust',
  Descartado: 'bg-sand text-dark-3',
  Finalizado: 'bg-teal text-white',
};

export const ceaTodosApi = {
  async list(): Promise<CeaTodo[]> {
    const { data, error } = await supabase
      .from('cea_todos')
      .select('*')
      .order('done', { ascending: true })
      .order('fecha', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: CeaTodoInsert): Promise<CeaTodo> {
    const { data, error } = await supabase.from('cea_todos').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: CeaTodoUpdate): Promise<CeaTodo> {
    const { data, error } = await supabase.from('cea_todos').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async toggleDone(id: string, done: boolean): Promise<void> {
    const { error } = await supabase.from('cea_todos').update({ done }).eq('id', id);
    if (error) throw error;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('cea_todos').delete().eq('id', id);
    if (error) throw error;
  },
};
