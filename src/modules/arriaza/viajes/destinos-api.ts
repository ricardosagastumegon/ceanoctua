// Fase 21 · destinos del viaje: países, ciudades y paradas.
//
// Las tres tablas se editan como una lista dentro del formulario del viaje, no
// una por una, así que la API expone `sync`: recibe la lista completa y la
// reconcilia contra lo que hay en la base — inserta lo nuevo, actualiza lo que
// cambió y marca `deleted_at` en lo que el usuario quitó.
//
// Nunca borra físicamente (invariante 6).

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttViajePais = Database['public']['Tables']['att_viaje_paises']['Row'];
export type AttViajeCiudad = Database['public']['Tables']['att_viaje_ciudades']['Row'];
export type AttViajeParada = Database['public']['Tables']['att_viaje_paradas']['Row'];

/** Lo que el formulario maneja: sin ids de auditoría y con id opcional. */
export type PaisInput = { id?: string; codigo: string; nombre: string };
export type CiudadInput = { id?: string; nombre: string; pais_codigo?: string | null };
export type ParadaInput = {
  id?: string;
  nombre: string;
  pais_codigo?: string | null;
  fecha_ini?: string | null;
  fecha_fin?: string | null;
};

export type ViajeDestinos = {
  paises: AttViajePais[];
  ciudades: AttViajeCiudad[];
  paradas: AttViajeParada[];
};

const ORDEN = { ascending: true, nullsFirst: true } as const;

export const attViajeDestinosApi = {
  async listByViaje(viajeId: string): Promise<ViajeDestinos> {
    const [paisesQ, ciudadesQ, paradasQ] = await Promise.all([
      supabase.from('att_viaje_paises').select('*')
        .eq('viaje_id', viajeId).is('deleted_at', null).order('orden', ORDEN),
      supabase.from('att_viaje_ciudades').select('*')
        .eq('viaje_id', viajeId).is('deleted_at', null).order('orden', ORDEN),
      supabase.from('att_viaje_paradas').select('*')
        .eq('viaje_id', viajeId).is('deleted_at', null).order('orden', ORDEN),
    ]);
    if (paisesQ.error) throw paisesQ.error;
    if (ciudadesQ.error) throw ciudadesQ.error;
    if (paradasQ.error) throw paradasQ.error;
    return {
      paises: paisesQ.data ?? [],
      ciudades: ciudadesQ.data ?? [],
      paradas: paradasQ.data ?? [],
    };
  },

  async sync(
    viajeId: string,
    input: { paises: PaisInput[]; ciudades: CiudadInput[]; paradas: ParadaInput[] },
  ): Promise<void> {
    const actual = await attViajeDestinosApi.listByViaje(viajeId);

    await syncTabla('att_viaje_paises', viajeId, actual.paises, input.paises, (p, orden) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      orden,
    }));

    await syncTabla('att_viaje_ciudades', viajeId, actual.ciudades, input.ciudades, (c, orden) => ({
      nombre: c.nombre,
      pais_codigo: c.pais_codigo ?? null,
      orden,
    }));

    await syncTabla('att_viaje_paradas', viajeId, actual.paradas, input.paradas, (p, orden) => ({
      nombre: p.nombre,
      pais_codigo: p.pais_codigo ?? null,
      fecha_ini: p.fecha_ini || null,
      fecha_fin: p.fecha_fin || null,
      orden,
    }));
  },
};

type Tabla = 'att_viaje_paises' | 'att_viaje_ciudades' | 'att_viaje_paradas';

/**
 * Reconcilia una lista contra las filas vivas de su tabla.
 *
 * El `orden` sale de la posición en el arreglo: el formulario decide la
 * secuencia y la base la respeta, así que el país en primera posición es
 * siempre el principal.
 */
async function syncTabla<T extends { id?: string }>(
  tabla: Tabla,
  viajeId: string,
  actuales: { id: string }[],
  deseados: T[],
  campos: (item: T, orden: number) => Record<string, unknown>,
): Promise<void> {
  const vivos = new Set(deseados.map((d) => d.id).filter(Boolean) as string[]);

  // Lo que el usuario quitó de la lista.
  const aBorrar = actuales.filter((a) => !vivos.has(a.id)).map((a) => a.id);
  if (aBorrar.length > 0) {
    const { error } = await supabase
      .from(tabla)
      .update({ deleted_at: new Date().toISOString() } as never)
      .in('id', aBorrar);
    if (error) throw error;
  }

  for (let i = 0; i < deseados.length; i++) {
    const item = deseados[i];
    const valores = campos(item, i);
    if (item.id) {
      const { error } = await supabase
        .from(tabla)
        .update(valores as never)
        .eq('id', item.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(tabla)
        .insert({ viaje_id: viajeId, ...valores } as never);
      if (error) throw error;
    }
  }
}
