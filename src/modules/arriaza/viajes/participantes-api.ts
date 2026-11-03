// Quién va en el viaje.
//
// Antes era una cadena de texto en `att_viajes.acompanantes`, y por eso el
// presidente aparecía escrito de cuatro formas en seis viajes. Ahora cada
// participante es un id contra uno de dos catálogos: `personas` --Personal
// JD-- o `invitados` --familia y acompañantes--.
//
// `acompanantes` sigue existiendo y lo leen ocho pantallas, pero ya no se
// escribe desde aquí: un trigger en la base lo recalcula desde esta tabla.
//
// Se borra físicamente, al revés que los destinos del viaje. Una fila de esta
// tabla no es un documento, es una pertenencia: «fulano va en este viaje». Si
// deja de ir, no queda nada que conservar más allá de lo que ya guardó el
// audit_log.

import { supabase } from '@/lib/supabase';

/** Un participante como lo maneja el formulario: de dónde sale y quién es. */
export type ParticipanteInput = {
  tipo: 'persona' | 'invitado';
  id: string;
  nombre: string;
};

export type ParticipanteRow = {
  id: string;
  viaje_id: string;
  persona_id: string | null;
  invitado_id: string | null;
  orden: number;
};

export const participantesApi = {
  async listByViaje(viajeId: string): Promise<ParticipanteRow[]> {
    const { data, error } = await supabase
      .from('att_viaje_participantes')
      .select('id, viaje_id, persona_id, invitado_id, orden')
      .eq('viaje_id', viajeId)
      .order('orden');
    if (error) throw error;
    return data ?? [];
  },

  /** Todos los participantes de todos los viajes, para filtrar la lista. */
  async listAll(): Promise<ParticipanteRow[]> {
    const { data, error } = await supabase
      .from('att_viaje_participantes')
      .select('id, viaje_id, persona_id, invitado_id, orden');
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Deja la lista del viaje igual a `deseados`.
   *
   * Solo toca lo que cambió: quien sigue en la lista conserva su fila, y con
   * ella su posición en el papel. Reescribirla entera cada vez llenaría el
   * audit_log de bajas y altas que no pasaron.
   */
  async sync(viajeId: string, deseados: ParticipanteInput[]): Promise<void> {
    const actuales = await participantesApi.listByViaje(viajeId);

    const claveRow = (r: ParticipanteRow) =>
      r.persona_id ? `persona:${r.persona_id}` : `invitado:${r.invitado_id}`;
    const claveInput = (p: ParticipanteInput) => `${p.tipo}:${p.id}`;

    const quedan = new Set(deseados.map(claveInput));
    const sobran = actuales.filter((r) => !quedan.has(claveRow(r))).map((r) => r.id);
    if (sobran.length > 0) {
      const { error } = await supabase
        .from('att_viaje_participantes')
        .delete()
        .in('id', sobran);
      if (error) throw error;
    }

    const existentes = new Map(actuales.map((r) => [claveRow(r), r]));

    for (let i = 0; i < deseados.length; i++) {
      const p = deseados[i];
      const ya = existentes.get(claveInput(p));
      if (ya) {
        if (ya.orden !== i) {
          const { error } = await supabase
            .from('att_viaje_participantes')
            .update({ orden: i })
            .eq('id', ya.id);
          if (error) throw error;
        }
        continue;
      }
      const { error } = await supabase.from('att_viaje_participantes').insert({
        viaje_id: viajeId,
        persona_id: p.tipo === 'persona' ? p.id : null,
        invitado_id: p.tipo === 'invitado' ? p.id : null,
        orden: i,
      });
      if (error) throw error;
    }
  },
};
