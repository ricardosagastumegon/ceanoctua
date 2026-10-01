// Aeronaves · Bitácora de vuelo.
//
// Lo que el piloto reporta después de volar. Es el origen de todo lo demás:
// de acá salen las horas, y de las horas saldrán después los cobros y la
// cuenta regresiva de los mantenimientos.
//
// Las horas salen del **horómetro**, no del reloj: cada tramo guarda el
// horómetro al salir y al llegar, la base calcula la diferencia, y el total
// del vuelo lo mantiene un trigger. Nada de eso se escribe desde acá.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Piloto = Database['public']['Tables']['avn_pilotos']['Row'];
export type PilotoInsert = Database['public']['Tables']['avn_pilotos']['Insert'];
export type Vuelo = Database['public']['Tables']['avn_vuelos']['Row'];
export type VueloInsert = Database['public']['Tables']['avn_vuelos']['Insert'];
export type Tramo = Database['public']['Tables']['avn_vuelo_tramos']['Row'];

export const MANDOS = [
  { key: 'piloto', label: 'Piloto' },
  { key: 'dueno', label: 'Dueño' },
  { key: 'instruccion', label: 'Instrucción' },
] as const;

export const rotuloMando = (k: string): string =>
  MANDOS.find((m) => m.key === k)?.label ?? k;

/** Un tramo como se captura en pantalla. Las horas no se escriben: se leen. */
export type TramoInput = {
  id?: string;
  origen: string;
  destino: string;
  hora_salida: string;
  hora_llegada: string;
  horometro_salida: string;
  horometro_llegada: string;
  espera: string;
  notas: string;
};

export type VueloCompleto = Vuelo & {
  tramos: Tramo[];
  pasajeros: string[];
  piloto: string | null;
  instructor: string | null;
};

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Las horas de un tramo, para mostrarlas mientras se escribe. */
export function horasTramo(t: { horometro_salida: string; horometro_llegada: string }): number {
  const a = t.horometro_salida.trim();
  const b = t.horometro_llegada.trim();
  if (!a || !b) return 0;
  return Math.round((num(b) - num(a)) * 10) / 10;
}

export function horasVuelo(tramos: TramoInput[]): number {
  return Math.round(tramos.reduce((s, t) => s + horasTramo(t), 0) * 10) / 10;
}

export function tramoVacio(): TramoInput {
  return {
    origen: '', destino: '', hora_salida: '', hora_llegada: '',
    horometro_salida: '', horometro_llegada: '', espera: '', notas: '',
  };
}

export const vuelosApi = {
  async pilotos(): Promise<Piloto[]> {
    const { data, error } = await supabase
      .from('avn_pilotos').select('*').is('deleted_at', null).order('nombre');
    if (error) throw error;
    return data ?? [];
  },

  async guardarPiloto(id: string | undefined, datos: PilotoInsert): Promise<void> {
    if (id) {
      // El `id` es la identidad de la fila, no un dato que se edite: el tipo
      // de Update lo rechaza y con razón.
      const { id: _i, ...patch } = datos;
      const { error } = await supabase.from('avn_pilotos').update(patch).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('avn_pilotos').insert(datos);
      if (error) throw error;
    }
  },

  async borrarPiloto(id: string): Promise<void> {
    const { error } = await supabase
      .from('avn_pilotos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /** Los vuelos de la aeronave, con sus tramos y sus pasajeros. */
  async list(aeronaveId: string): Promise<VueloCompleto[]> {
    const [vue, pil] = await Promise.all([
      supabase.from('avn_vuelos').select('*')
        .eq('aeronave_id', aeronaveId).is('deleted_at', null)
        .order('fecha', { ascending: false }),
      supabase.from('avn_pilotos').select('id, nombre').is('deleted_at', null),
    ]);
    if (vue.error) throw vue.error;
    if (pil.error) throw pil.error;

    const vuelos = vue.data ?? [];
    if (vuelos.length === 0) return [];
    const ids = vuelos.map((v) => v.id);

    const [tra, pax] = await Promise.all([
      supabase.from('avn_vuelo_tramos').select('*')
        .in('vuelo_id', ids).is('deleted_at', null).order('orden'),
      supabase.from('avn_vuelo_pax').select('*')
        .in('vuelo_id', ids).is('deleted_at', null).order('orden'),
    ]);
    if (tra.error) throw tra.error;
    if (pax.error) throw pax.error;

    const nombrePiloto = new Map((pil.data ?? []).map((p) => [p.id, p.nombre]));

    return vuelos.map((v) => ({
      ...v,
      tramos: (tra.data ?? []).filter((t) => t.vuelo_id === v.id),
      pasajeros: (pax.data ?? []).filter((p) => p.vuelo_id === v.id).map((p) => p.nombre ?? ''),
      piloto: v.piloto_id ? nombrePiloto.get(v.piloto_id) ?? null : null,
      instructor: v.instructor_id ? nombrePiloto.get(v.instructor_id) ?? null : null,
    }));
  },

  /**
   * Guarda el vuelo con sus tramos y sus pasajeros.
   *
   * Tramos y pasajeros se rehacen enteros. Un tramo es un dato operativo, no
   * dinero: no hay nada que conservar entre una edición y otra más allá de lo
   * que ya guarda `audit_log`. El borrado sigue siendo en suave por eso mismo.
   */
  async save(vars: {
    id?: string;
    cabecera: VueloInsert;
    tramos: TramoInput[];
    pasajeros: string[];
  }): Promise<string> {
    const { id, cabecera, tramos, pasajeros } = vars;

    let vueloId = id;
    if (vueloId) {
      const { aeronave_id: _a, id: _i, serial: _s, ...patch } = cabecera;
      const { error } = await supabase.from('avn_vuelos').update(patch).eq('id', vueloId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('avn_vuelos').insert(cabecera).select('id').single();
      if (error) throw error;
      vueloId = data.id;
    }

    await Promise.all([
      rehacer('avn_vuelo_tramos', vueloId as string, tramos
        .filter((t) => t.origen.trim() || t.destino.trim() || t.horometro_salida.trim())
        .map((t, orden) => ({
          origen: t.origen.trim().toUpperCase() || null,
          destino: t.destino.trim().toUpperCase() || null,
          hora_salida: t.hora_salida || null,
          hora_llegada: t.hora_llegada || null,
          horometro_salida: t.horometro_salida.trim() === '' ? null : num(t.horometro_salida),
          horometro_llegada: t.horometro_llegada.trim() === '' ? null : num(t.horometro_llegada),
          espera: num(t.espera),
          notas: t.notas.trim() || null,
          orden,
        }))),
      rehacer('avn_vuelo_pax', vueloId as string, pasajeros
        .map((n) => n.trim()).filter(Boolean)
        .map((nombre, orden) => ({ nombre, orden }))),
    ]);

    return vueloId as string;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('avn_vuelos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

/** Borra en suave lo que había y vuelve a insertar. */
async function rehacer(
  tabla: 'avn_vuelo_tramos' | 'avn_vuelo_pax',
  vueloId: string,
  filas: Record<string, unknown>[],
): Promise<void> {
  const previos = await supabase
    .from(tabla).select('id').eq('vuelo_id', vueloId).is('deleted_at', null);
  if (previos.error) throw previos.error;

  if (previos.data?.length) {
    const { error } = await supabase
      .from(tabla)
      .update({ deleted_at: new Date().toISOString() })
      .in('id', previos.data.map((p) => p.id));
    if (error) throw error;
  }

  if (filas.length) {
    const { error } = await supabase
      .from(tabla)
      .insert(filas.map((f) => ({ vuelo_id: vueloId, ...f })) as never);
    if (error) throw error;
  }
}
