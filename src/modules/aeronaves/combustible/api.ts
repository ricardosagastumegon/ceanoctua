// Control de combustible de una aeronave.
//
// Registro de vales y facturas, y el puente hacia la solicitud de pago. El
// puente NO es nuevo: `pagos_notificaciones` ya lo usan las liquidaciones de
// Caja Chica y los consumos de tarjeta. Aquí solo se agregó un origen más.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Registro = Database['public']['Tables']['avn_combustible_registros']['Row'];
export type RegistroInsert = Database['public']['Tables']['avn_combustible_registros']['Insert'];
export type RegistroUpdate = Database['public']['Tables']['avn_combustible_registros']['Update'];
export type Linea = Database['public']['Tables']['avn_combustible_lineas']['Row'];

/** Lo que se captura de una línea antes de que la base calcule su total. */
export type LineaInput = {
  producto: string;
  galones: number;
  precio_unitario: number;
};

/** Un registro con sus líneas y el estado de su solicitud de pago. */
export type RegistroCompleto = Registro & {
  lineas: Linea[];
  /** La notificación que se le mandó a Pagos, si ya se envió. */
  notificacion_id: string | null;
  notificacion_procesada: boolean;
  /** La solicitud que Pagos generó a partir de ella, si ya la generaron. */
  pago_id: string | null;
  pago_serial: string | null;
};

export const combustibleApi = {
  /**
   * Los registros de la aeronave, con sus líneas y el estado de su pago.
   *
   * El estado se arma en dos saltos: del registro a su notificación, y de la
   * notificación a la solicitud que salió de ella. Va en consultas aparte y
   * no en un join porque `pagos` y `pagos_notificaciones` viven en otro
   * módulo y no hay relación declarada entre ellas y el registro.
   */
  async list(aeronaveId: string): Promise<RegistroCompleto[]> {
    const { data, error } = await supabase
      .from('avn_combustible_registros')
      .select('*, avn_combustible_lineas(*)')
      .eq('aeronave_id', aeronaveId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false });
    if (error) throw error;

    const registros = (data ?? []) as unknown as (Registro & { avn_combustible_lineas: Linea[] })[];
    if (registros.length === 0) return [];

    const ids = registros.map((r) => r.id);
    const notifs = await supabase
      .from('pagos_notificaciones')
      .select('id, origen_id, procesado')
      .eq('origen_tipo', 'combustible')
      .in('origen_id', ids);
    if (notifs.error) throw notifs.error;

    const porRegistro = new Map((notifs.data ?? []).map((n) => [n.origen_id, n]));
    const notifIds = (notifs.data ?? []).map((n) => n.id);

    let pagos: { id: string; serial: string | null; origen_notificacion_id: string | null }[] = [];
    if (notifIds.length) {
      const res = await supabase
        .from('pagos')
        .select('id, serial, origen_notificacion_id')
        .in('origen_notificacion_id', notifIds)
        .is('deleted_at', null);
      if (res.error) throw res.error;
      pagos = res.data ?? [];
    }
    const porNotif = new Map(pagos.map((p) => [p.origen_notificacion_id, p]));

    return registros.map((r) => {
      const { avn_combustible_lineas, ...resto } = r;
      const notif = porRegistro.get(r.id);
      const pago = notif ? porNotif.get(notif.id) : undefined;
      return {
        ...resto,
        lineas: [...(avn_combustible_lineas ?? [])].sort((a, b) => a.orden - b.orden),
        notificacion_id: notif?.id ?? null,
        notificacion_procesada: notif?.procesado ?? false,
        pago_id: pago?.id ?? null,
        pago_serial: pago?.serial ?? null,
      };
    });
  },

  /** Crea el registro y sus líneas. El total lo calcula la base. */
  async create(input: RegistroInsert, lineas: LineaInput[]): Promise<Registro> {
    const { data, error } = await supabase
      .from('avn_combustible_registros')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    await reemplazarLineas(data.id, lineas);
    return data;
  },

  async update(id: string, patch: RegistroUpdate, lineas: LineaInput[]): Promise<void> {
    const { error } = await supabase
      .from('avn_combustible_registros')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
    await reemplazarLineas(id, lineas);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('avn_combustible_registros')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Avisa a Finanzas → Pagos que este registro necesita su solicitud.
   *
   * No crea el pago: deja una notificación, y quien administra pagos la
   * procesa extrayendo los datos del registro. Es el mismo camino de los
   * consumos de tarjeta.
   */
  async enviarAPagos(r: RegistroCompleto): Promise<void> {
    const detalle = r.lineas.map((l) => l.producto).join(', ');
    const resumen = [
      `Combustible ${r.serial ?? ''}`.trim(),
      r.vale ? `Vale ${r.vale}` : null,
      r.factura ? `Factura ${r.factura}` : null,
      r.fer_ap ? `FER/AP ${r.fer_ap}` : null,
      detalle || null,
    ]
      .filter(Boolean)
      .join(' · ');

    const { error } = await supabase.from('pagos_notificaciones').insert({
      origen_tipo: 'combustible',
      origen_id: r.id,
      monto: Number(r.total),
      moneda: r.moneda,
      resumen,
    });
    if (error) throw error;
  },
};

/**
 * Las líneas se reescriben enteras en vez de irse comparando una por una.
 * Son tres o cuatro renglones y esto elimina todo el enredo de saber cuál se
 * editó, cuál se agregó y cuál se quitó.
 */
async function reemplazarLineas(registroId: string, lineas: LineaInput[]): Promise<void> {
  const del = await supabase
    .from('avn_combustible_lineas')
    .delete()
    .eq('registro_id', registroId);
  if (del.error) throw del.error;

  if (lineas.length === 0) return;
  const { error } = await supabase.from('avn_combustible_lineas').insert(
    lineas.map((l, i) => ({
      registro_id: registroId,
      producto: l.producto,
      galones: l.galones,
      precio_unitario: l.precio_unitario,
      orden: i,
    })),
  );
  if (error) throw error;
}
