// Los servicios del viaje, convertidos en eventos con fecha y hora para que el
// Itinerario Final los muestre día por día.
//
// El requisito del usuario: "todo servicio creado con fechas deberá agregarse
// al itinerario general". Hasta ahora el itinerario solo mostraba lo que se
// escribía a mano en el plan del día, así que un vuelo o un hotel reservados no
// aparecían por ningún lado.
//
// Cada servicio aporta uno o dos eventos: los que tienen ida y vuelta o entrada
// y salida generan dos, para que el día del regreso no quede vacío.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ServiceKey } from '../constants/serviceMeta';

export type EventoItinerario = {
  servicio: ServiceKey;
  /** 'YYYY-MM-DD' */
  fecha: string;
  /** 'HH:MM' o '' si el servicio no guarda hora. */
  hora: string;
  titulo: string;
  detalle: string;
};

const hhmm = (v: string | null | undefined): string => (v ? v.slice(0, 5) : '');
const limpio = (...partes: (string | null | undefined)[]) =>
  partes.filter((p) => p && String(p).trim()).join(' · ');

export function useItineraryEvents(viajeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['att_itinerary_events', viajeId],
    enabled: !!viajeId && enabled,
    queryFn: async (): Promise<EventoItinerario[]> => {
      const id = viajeId as string;
      const vivo = { deleted_at: null };
      const ev: EventoItinerario[] = [];

      const [
        tickets, hoteles, restaurantes, rentas, tours,
        aeronaves, acuaticos, ferries, terrestres, actividades, reuniones,
      ] = await Promise.all([
        supabase.from('att_tickets').select('id, aerolinea, titulo').match({ viaje_id: id, ...vivo }),
        supabase.from('att_hoteles').select('nombre, ciudad, checkin, checkout').match({ viaje_id: id, ...vivo }),
        supabase.from('att_restaurantes').select('nombre, ciudad, fecha, hora').match({ viaje_id: id, ...vivo }),
        supabase.from('att_rentas').select('nombre, ciudad, recepcion_fecha, recepcion_hora, entrega_fecha, entrega_hora').match({ viaje_id: id, ...vivo }),
        supabase.from('att_tours').select('nombre, prestador, ciudad, fecha, hora, hora_fin').match({ viaje_id: id, ...vivo }),
        supabase.from('att_aeronaves').select('prestador, origen, destino, fecha, hora').match({ viaje_id: id, ...vivo }),
        supabase.from('att_acuaticos').select('prestador, origen, destino, fecha, etd, ret_fecha, ret_etd').match({ viaje_id: id, ...vivo }),
        supabase.from('att_ferries').select('prestador, origen, destino, fecha, etd, ret_fecha, ret_etd').match({ viaje_id: id, ...vivo }),
        supabase.from('att_terrestres').select('prestador, origen, destino, fecha, etd, ret_fecha, ret_etd').match({ viaje_id: id, ...vivo }),
        supabase.from('att_actividades').select('evento, ciudad, fecha, inicio').match({ viaje_id: id, ...vivo }),
        supabase.from('att_reuniones').select('cita, asunto, ciudad, fecha, hora').match({ viaje_id: id, ...vivo }),
      ]);

      for (const r of [tickets, hoteles, restaurantes, rentas, tours, aeronaves, acuaticos, ferries, terrestres, actividades, reuniones]) {
        if (r.error) throw r.error;
      }

      // Los vuelos se leen por segmento y no por ticket: un ticket de ida y
      // vuelta con escalas son varios movimientos en días distintos.
      const ticketIds = (tickets.data ?? []).map((t) => t.id);
      if (ticketIds.length > 0) {
        const segs = await supabase
          .from('att_ticket_segments')
          .select('ticket_id, origen_iata, destino_iata, fecha, etd, numero_vuelo')
          .in('ticket_id', ticketIds)
          .is('deleted_at', null);
        if (segs.error) throw segs.error;
        const aerolineaPorTicket = new Map(
          (tickets.data ?? []).map((t) => [t.id, t.aerolinea ?? t.titulo ?? 'Vuelo']),
        );
        for (const s of segs.data ?? []) {
          if (!s.fecha) continue;
          ev.push({
            servicio: 'tickets',
            fecha: s.fecha,
            hora: hhmm(s.etd),
            titulo: `${s.origen_iata ?? '?'} → ${s.destino_iata ?? '?'}`,
            detalle: limpio(aerolineaPorTicket.get(s.ticket_id), s.numero_vuelo),
          });
        }
      }

      for (const h of hoteles.data ?? []) {
        if (h.checkin) ev.push({ servicio: 'hotel', fecha: h.checkin, hora: '', titulo: `Check-in · ${h.nombre ?? 'Hotel'}`, detalle: limpio(h.ciudad) });
        if (h.checkout) ev.push({ servicio: 'hotel', fecha: h.checkout, hora: '', titulo: `Check-out · ${h.nombre ?? 'Hotel'}`, detalle: limpio(h.ciudad) });
      }
      for (const r of restaurantes.data ?? []) {
        if (r.fecha) ev.push({ servicio: 'restaurantes', fecha: r.fecha, hora: hhmm(r.hora), titulo: r.nombre ?? 'Restaurante', detalle: limpio(r.ciudad) });
      }
      for (const r of rentas.data ?? []) {
        if (r.recepcion_fecha) ev.push({ servicio: 'renta', fecha: r.recepcion_fecha, hora: hhmm(r.recepcion_hora), titulo: `Recepción · ${r.nombre ?? 'Vehículo'}`, detalle: limpio(r.ciudad) });
        if (r.entrega_fecha) ev.push({ servicio: 'renta', fecha: r.entrega_fecha, hora: hhmm(r.entrega_hora), titulo: `Entrega · ${r.nombre ?? 'Vehículo'}`, detalle: limpio(r.ciudad) });
      }
      for (const t of tours.data ?? []) {
        // El tour se anuncia por su nombre; el prestador es quien lo opera.
        if (t.fecha) ev.push({
          servicio: 'tours', fecha: t.fecha, hora: hhmm(t.hora),
          titulo: t.nombre || t.prestador || 'Tour',
          detalle: limpio(t.nombre ? t.prestador : null, t.ciudad, t.hora_fin ? `hasta ${hhmm(t.hora_fin)}` : null),
        });
      }
      for (const a of aeronaves.data ?? []) {
        if (a.fecha) ev.push({ servicio: 'aeronave', fecha: a.fecha, hora: hhmm(a.hora), titulo: `${a.origen ?? '?'} → ${a.destino ?? '?'}`, detalle: limpio(a.prestador) });
      }
      for (const [key, rows] of [
        ['acuatico', acuaticos.data],
        ['ferry', ferries.data],
        ['terrestre', terrestres.data],
      ] as const) {
        for (const x of rows ?? []) {
          if (x.fecha) ev.push({ servicio: key, fecha: x.fecha, hora: hhmm(x.etd), titulo: `${x.origen ?? '?'} → ${x.destino ?? '?'}`, detalle: limpio(x.prestador) });
          if (x.ret_fecha) ev.push({ servicio: key, fecha: x.ret_fecha, hora: hhmm(x.ret_etd), titulo: `Retorno · ${x.destino ?? '?'} → ${x.origen ?? '?'}`, detalle: limpio(x.prestador) });
        }
      }
      for (const a of actividades.data ?? []) {
        if (a.fecha) ev.push({ servicio: 'actividades', fecha: a.fecha, hora: hhmm(a.inicio), titulo: a.evento ?? 'Actividad', detalle: limpio(a.ciudad) });
      }
      for (const r of reuniones.data ?? []) {
        if (r.fecha) ev.push({ servicio: 'reunion', fecha: r.fecha, hora: hhmm(r.hora), titulo: r.cita ?? r.asunto ?? 'Reunión', detalle: limpio(r.asunto !== r.cita ? r.asunto : null, r.ciudad) });
      }

      // Sin hora van primero: son cosas del día, no de un momento.
      ev.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
      return ev;
    },
  });
}
