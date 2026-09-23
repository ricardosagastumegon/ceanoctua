// Fase 22 · reuniones. Cierra los once servicios de T&T.
//
// Es el unico servicio sin costo: no aporta al total del viaje. Lo que si
// tiene es una tabla hija, los participantes -- nombre, referencia y telefono
// --, asi que guardar reconcilia: inserta los nuevos, actualiza los que
// cambiaron y borra en suave los que se quitaron.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttReunion = Database['public']['Tables']['att_reuniones']['Row'];
export type AttReunionInsert = Database['public']['Tables']['att_reuniones']['Insert'];
export type AttParticipante = Database['public']['Tables']['att_reunion_participantes']['Row'];

/** Del documento: presencial, virtual o las dos cosas a la vez. */
export const TIPOS_REUNION = ['Presencial', 'Virtual', 'Presencial & Virtual'] as const;
export type TipoReunion = (typeof TIPOS_REUNION)[number];

/** Un participante en el formulario. Sin `id` todavia no existe en la base. */
export type ParticipanteInput = {
  id?: string;
  nombre: string;
  referencia: string;
  telefono: string;
};

export async function listarParticipantes(reunionId: string): Promise<AttParticipante[]> {
  const { data, error } = await supabase
    .from('att_reunion_participantes')
    .select('*')
    .eq('reunion_id', reunionId)
    .is('deleted_at', null)
    .order('orden', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function sincronizarParticipantes(
  reunionId: string,
  deseados: ParticipanteInput[],
): Promise<void> {
  const actuales = await listarParticipantes(reunionId);
  const vivos = new Set(deseados.map((d) => d.id).filter(Boolean) as string[]);

  const aBorrar = actuales.filter((a) => !vivos.has(a.id)).map((a) => a.id);
  if (aBorrar.length > 0) {
    const { error } = await supabase
      .from('att_reunion_participantes')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', aBorrar);
    if (error) throw error;
  }

  for (let i = 0; i < deseados.length; i++) {
    const d = deseados[i];
    const valores = {
      nombre: d.nombre.trim() || null,
      referencia: d.referencia.trim() || null,
      telefono: d.telefono.trim() || null,
      orden: i,
    };
    if (d.id) {
      const { error } = await supabase
        .from('att_reunion_participantes').update(valores).eq('id', d.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('att_reunion_participantes').insert({ reunion_id: reunionId, ...valores });
      if (error) throw error;
    }
  }
}

export const reunionesFullApi = {
  async load(id: string): Promise<{ cabecera: AttReunion | null; participantes: AttParticipante[] }> {
    const { data, error } = await supabase
      .from('att_reuniones').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    if (!data) return { cabecera: null, participantes: [] };
    return { cabecera: data, participantes: await listarParticipantes(id) };
  },

  async save(input: {
    id?: string;
    cabecera: AttReunionInsert;
    participantes: ParticipanteInput[];
  }): Promise<string> {
    let id = input.id;
    if (id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_reuniones')
        .update(patch as Database['public']['Tables']['att_reuniones']['Update'])
        .eq('id', id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('att_reuniones').insert(input.cabecera).select('id').single();
      if (error) throw error;
      id = data.id;
    }
    await sincronizarParticipantes(id, input.participantes);
    return id;
  },
};
