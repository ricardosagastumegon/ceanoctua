// Fase 22 · el ticket aéreo completo, con sus hijos.
//
// El formulario del documento captura de un solo golpe el encabezado, los PNR,
// los segmentos con sus escalas y los pasajeros. Hacerlo tabla por tabla desde
// la UI obligaría a guardar el ticket antes de poder agregar un pasajero — que
// es justo lo que hacía el formulario viejo y lo que el usuario no quiere.
//
// Por eso esto expone dos operaciones: `load` trae el árbol completo y `save`
// lo reconcilia contra la base. Mismo patrón que los destinos del viaje.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttTicket = Database['public']['Tables']['att_tickets']['Row'];
export type AttTicketInsert = Database['public']['Tables']['att_tickets']['Insert'];

/** Opciones del documento. */
export const CATEGORIAS = ['Económica', 'Premium Economy', 'Ejecutiva', 'Primera Clase'] as const;
export const TIPOS_TICKET = ['OW', 'RT'] as const;
export const FORMAS_PAGO = ['DINERO', 'MILLAS', 'PUNTOS', 'CREDITOS DE VIAJE'] as const;

/**
 * Lista unificada de estatus de pago para todos los servicios del módulo.
 * Las cinco primeras vienen del documento del ticket; la última se conserva
 * porque es un estado real de los hoteles que ese documento no cubre.
 */
export const ESTATUS_PAGO = [
  'HOLD',
  'PAGO PARCIAL',
  'CONFIRMADO',
  'CANCELADO',
  'ABIERTO',
  'A PAGAR EN PROPIEDAD',
] as const;

export type EscalaInput = {
  id?: string;
  iata: string;
  ciudad: string;
  tiempo: string;
};

export type SegmentoInput = {
  id?: string;
  /** 'ida' | 'retorno' — en un OW todos son 'ida'. */
  direccion: string;
  ruta: string;
  origen_iata: string;
  origen_ciudad: string;
  destino_iata: string;
  destino_ciudad: string;
  fecha: string;
  fecha_llegada: string;
  etd: string;
  eta: string;
  numero_vuelo: string;
  pnrs: string[];
  escalas: EscalaInput[];
};

export type PaxInput = {
  id?: string;
  nombre: string;
  nacionalidades: string[];
  pasaporte_num: string;
  libreta_num: string;
  visa_num: string;
  ffn: string;
  numero_ticket: string;
  asiento: string;
  eq_personal: string;
  eq_carryon: string;
  eq_documentado: string;
  tarifa: string;
  tarifa_nota: string;
  extras: string;
  extras_nota: string;
};

export type TicketCompleto = {
  ticket: AttTicket | null;
  pnrs: string[];
  segmentos: SegmentoInput[];
  pax: PaxInput[];
};

const ORDEN = { ascending: true, nullsFirst: true } as const;

/** Suma de (tarifa + extras) de cada pasajero. No se multiplica por el número
 *  de pasajeros: cada uno ya trae su propia tarifa. */
export function totalTicket(pax: PaxInput[]): number {
  return pax.reduce((s, p) => s + num(p.tarifa) + num(p.extras), 0);
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const ticketFullApi = {
  async load(ticketId: string): Promise<TicketCompleto> {
    const [ticketQ, pnrQ, segQ, paxQ] = await Promise.all([
      supabase.from('att_tickets').select('*').eq('id', ticketId).is('deleted_at', null).maybeSingle(),
      supabase.from('att_ticket_pnrs').select('*').eq('ticket_id', ticketId).is('deleted_at', null).order('orden', ORDEN),
      supabase.from('att_ticket_segments').select('*').eq('ticket_id', ticketId).is('deleted_at', null).order('orden', ORDEN),
      supabase.from('att_ticket_pax').select('*').eq('ticket_id', ticketId).is('deleted_at', null).order('orden', ORDEN),
    ]);
    if (ticketQ.error) throw ticketQ.error;
    if (pnrQ.error) throw pnrQ.error;
    if (segQ.error) throw segQ.error;
    if (paxQ.error) throw paxQ.error;

    const segmentos = segQ.data ?? [];
    const escalasQ = segmentos.length
      ? await supabase
          .from('att_segmento_escalas')
          .select('*')
          .in('segmento_id', segmentos.map((s) => s.id))
          .is('deleted_at', null)
          .order('orden', ORDEN)
      : { data: [], error: null };
    if (escalasQ.error) throw escalasQ.error;

    const pnrsTicket = (pnrQ.data ?? []).filter((p) => !p.segmento_id).map((p) => p.codigo);

    return {
      ticket: ticketQ.data,
      pnrs: pnrsTicket,
      segmentos: segmentos.map((s) => ({
        id: s.id,
        direccion: s.direccion ?? 'ida',
        ruta: s.ruta ?? '',
        origen_iata: s.origen_iata ?? '',
        origen_ciudad: s.origen_ciudad ?? '',
        destino_iata: s.destino_iata ?? '',
        destino_ciudad: s.destino_ciudad ?? '',
        fecha: s.fecha ?? '',
        fecha_llegada: s.fecha_llegada ?? '',
        etd: s.etd ?? '',
        eta: s.eta ?? '',
        numero_vuelo: s.numero_vuelo ?? '',
        pnrs: (pnrQ.data ?? []).filter((p) => p.segmento_id === s.id).map((p) => p.codigo),
        escalas: (escalasQ.data ?? [])
          .filter((e) => e.segmento_id === s.id)
          .map((e) => ({ id: e.id, iata: e.iata ?? '', ciudad: e.ciudad ?? '', tiempo: e.tiempo ?? '' })),
      })),
      pax: (paxQ.data ?? []).map((p) => ({
        id: p.id,
        nombre: p.nombre ?? '',
        nacionalidades: p.nacionalidades ?? [],
        pasaporte_num: p.pasaporte_num ?? '',
        libreta_num: p.libreta_num ?? '',
        visa_num: p.visa_num ?? '',
        ffn: p.ffn ?? '',
        numero_ticket: p.numero_ticket ?? '',
        asiento: p.asiento ?? '',
        eq_personal: p.eq_personal ?? '',
        eq_carryon: p.eq_carryon ?? '',
        eq_documentado: p.eq_documentado ?? '',
        tarifa: p.tarifa != null ? String(p.tarifa) : '',
        tarifa_nota: p.tarifa_nota ?? '',
        extras: p.extras != null ? String(p.extras) : '',
        extras_nota: p.extras_nota ?? '',
      })),
    };
  },

  /** Guarda el ticket y reconcilia sus hijos. Devuelve el id del ticket. */
  async save(input: {
    ticketId?: string;
    cabecera: AttTicketInsert;
    pnrs: string[];
    segmentos: SegmentoInput[];
    pax: PaxInput[];
  }): Promise<string> {
    const monto = totalTicket(input.pax);
    const cabecera = { ...input.cabecera, monto };

    let ticketId = input.ticketId;
    if (ticketId) {
      const { error } = await supabase.from('att_tickets').update(aPatch(cabecera)).eq('id', ticketId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('att_tickets').insert(cabecera).select('id').single();
      if (error) throw error;
      ticketId = data.id;
    }

    await savePax(ticketId, input.pax);
    await saveSegmentos(ticketId, input.segmentos);
    await savePnrsTicket(ticketId, input.pnrs);
    return ticketId;
  },
};

/**
 * El formulario arma siempre la forma de un INSERT, pero un UPDATE no acepta
 * las columnas que solo se fijan al crear (id, viaje_id, quién y cuándo lo
 * creó). Se quitan aquí en vez de mantener dos objetos en paralelo.
 */
function aPatch(
  c: AttTicketInsert,
): Database['public']['Tables']['att_tickets']['Update'] {
  const patch = { ...c } as Record<string, unknown>;
  for (const k of ['id', 'viaje_id', 'legacy_id', 'created_at', 'created_by']) delete patch[k];
  return patch as Database['public']['Tables']['att_tickets']['Update'];
}

async function borrarSobrantes(tabla: string, columna: string, padreId: string, vivos: string[]) {
  const q = supabase
    .from(tabla as 'att_ticket_pax')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq(columna, padreId)
    .is('deleted_at', null);
  const { error } = vivos.length > 0 ? await q.not('id', 'in', `(${vivos.join(',')})`) : await q;
  if (error) throw error;
}

async function savePax(ticketId: string, pax: PaxInput[]) {
  await borrarSobrantes('att_ticket_pax', 'ticket_id', ticketId, pax.map((p) => p.id).filter(Boolean) as string[]);
  for (let i = 0; i < pax.length; i++) {
    const p = pax[i];
    const valores = {
      nombre: p.nombre.trim(),
      nacionalidades: p.nacionalidades.length ? p.nacionalidades : null,
      pasaporte_num: p.pasaporte_num.trim() || null,
      libreta_num: p.libreta_num.trim() || null,
      visa_num: p.visa_num.trim() || null,
      ffn: p.ffn.trim() || null,
      numero_ticket: p.numero_ticket.trim() || null,
      asiento: p.asiento.trim() || null,
      eq_personal: p.eq_personal.trim() || null,
      eq_carryon: p.eq_carryon.trim() || null,
      eq_documentado: p.eq_documentado.trim() || null,
      tarifa: p.tarifa.trim() === '' ? null : Number(p.tarifa),
      tarifa_nota: p.tarifa_nota.trim() || null,
      extras: p.extras.trim() === '' ? null : Number(p.extras),
      extras_nota: p.extras_nota.trim() || null,
      orden: i,
    };
    if (p.id) {
      const { error } = await supabase.from('att_ticket_pax').update(valores).eq('id', p.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('att_ticket_pax').insert({ ticket_id: ticketId, ...valores });
      if (error) throw error;
    }
  }
}

async function saveSegmentos(ticketId: string, segmentos: SegmentoInput[]) {
  await borrarSobrantes(
    'att_ticket_segments', 'ticket_id', ticketId,
    segmentos.map((s) => s.id).filter(Boolean) as string[],
  );

  for (let i = 0; i < segmentos.length; i++) {
    const s = segmentos[i];
    const valores = {
      direccion: s.direccion,
      ruta: s.ruta.trim() || null,
      origen_iata: s.origen_iata.trim() || null,
      origen_ciudad: s.origen_ciudad.trim() || null,
      destino_iata: s.destino_iata.trim() || null,
      destino_ciudad: s.destino_ciudad.trim() || null,
      fecha: s.fecha || null,
      fecha_llegada: s.fecha_llegada || null,
      etd: s.etd || null,
      eta: s.eta || null,
      numero_vuelo: s.numero_vuelo.trim() || null,
      orden: i,
    };
    let segId = s.id;
    if (segId) {
      const { error } = await supabase.from('att_ticket_segments').update(valores).eq('id', segId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('att_ticket_segments')
        .insert({ ticket_id: ticketId, ...valores })
        .select('id')
        .single();
      if (error) throw error;
      segId = data.id;
    }

    await saveEscalas(segId, s.escalas);
    await savePnrsSegmento(ticketId, segId, s.pnrs);
  }
}

async function saveEscalas(segmentoId: string, escalas: EscalaInput[]) {
  await borrarSobrantes(
    'att_segmento_escalas', 'segmento_id', segmentoId,
    escalas.map((e) => e.id).filter(Boolean) as string[],
  );
  for (let i = 0; i < escalas.length; i++) {
    const e = escalas[i];
    const valores = {
      iata: e.iata.trim() || null,
      ciudad: e.ciudad.trim() || null,
      tiempo: e.tiempo.trim() || null,
      orden: i,
    };
    if (e.id) {
      const { error } = await supabase.from('att_segmento_escalas').update(valores).eq('id', e.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('att_segmento_escalas')
        .insert({ segmento_id: segmentoId, ...valores });
      if (error) throw error;
    }
  }
}

/**
 * Los PNR se guardan como filas, no como lista editable: son códigos cortos y
 * se reemplazan enteros cada vez. Marcar y reinsertar es más simple que
 * reconciliar por id y no cuesta nada con dos o tres códigos.
 */
async function reemplazarPnrs(
  filtro: { ticketId: string; segmentoId: string | null },
  codigos: string[],
) {
  const base = supabase
    .from('att_ticket_pnrs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('ticket_id', filtro.ticketId)
    .is('deleted_at', null);
  const { error: delErr } = filtro.segmentoId
    ? await base.eq('segmento_id', filtro.segmentoId)
    : await base.is('segmento_id', null);
  if (delErr) throw delErr;

  const limpios = codigos.map((c) => c.trim()).filter(Boolean);
  if (limpios.length === 0) return;
  const { error } = await supabase.from('att_ticket_pnrs').insert(
    limpios.map((codigo, orden) => ({
      ticket_id: filtro.ticketId,
      segmento_id: filtro.segmentoId,
      codigo,
      orden,
    })),
  );
  if (error) throw error;
}

const savePnrsTicket = (ticketId: string, codigos: string[]) =>
  reemplazarPnrs({ ticketId, segmentoId: null }, codigos);

const savePnrsSegmento = (ticketId: string, segmentoId: string, codigos: string[]) =>
  reemplazarPnrs({ ticketId, segmentoId }, codigos);
