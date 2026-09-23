// La ruta del viaje, en el orden en que de verdad ocurre.
//
// El problema que resuelve: el riel lateral se armaba con `att_viaje_ciudades`,
// que es una lista sin fechas -- ahí solo se sabe *a qué ciudades* va el viaje,
// no *cuándo* se llega a cada una. Con Miami y Nueva York capturadas en ese
// orden o en el contrario, el riel las mostraba como viniera, y un viaje que
// pasa primero por Miami se veía al revés.
//
// La solución es no preguntarle a la lista de ciudades sino a los servicios,
// que sí tienen fecha:
//
//   1. Los SEGMENTOS de los tickets son la mejor fuente: cada uno dice a qué
//      ciudad se llega y qué día. Un GUA→MIA el 24 y un MIA→JFK el 25 ordenan
//      el viaje solos.
//   2. Los HOTELES aportan la ciudad donde se duerme, con su check-in.
//   3. Las PARADAS del viaje traen su propia ventana de fechas.
//
// Lo que NO alimenta el riel es `att_viaje_ciudades`. Una ciudad sin fecha no
// tiene lugar en una línea de tiempo, y colgarla al final crea duplicados
// cuando está escrita distinto que en el vuelo -- "New York" capturada a mano
// contra "Nueva York" del aeropuerto JFK son la misma escala escrita de dos
// formas. Esas ciudades se siguen viendo en "Datos del viaje", que es donde
// corresponde: ahí la lista no promete un orden.
//
// Cuando dos fuentes coinciden en el mismo día se queda la más confiable, por
// la misma razón: el hotel "Brooklyn NY" y el vuelo a "Nueva York" del mismo
// día son una sola escala.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { findAirport } from '../constants/airports';

export type OrigenRuta = 'vuelo' | 'hotel' | 'parada';

export type PasoRuta = {
  ciudad: string;
  /** 'YYYY-MM-DD'. Todo paso del riel tiene fecha; de eso se trata. */
  fecha: string;
  /** Hasta cuándo, cuando la fuente lo sabe (paradas y hoteles). */
  hasta: string | null;
  origen: OrigenRuta;
};

export type RutaViaje = {
  /** De dónde sale el viaje, según el primer vuelo. */
  salida: { ciudad: string | null; fecha: string | null };
  pasos: PasoRuta[];
};

/** Para comparar "Nueva York" con "nueva york" sin fallar por tildes. */
const clave = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const ciudadDe = (ciudad: string | null, iata: string | null): string | null => {
  if (ciudad && ciudad.trim()) return ciudad.trim();
  if (!iata) return null;
  return findAirport(iata)?.city ?? iata;
};

export function useTripRoute(viajeId: string | undefined) {
  return useQuery({
    queryKey: ['att_trip_route', viajeId],
    enabled: !!viajeId,
    queryFn: async (): Promise<RutaViaje> => {
      const id = viajeId as string;

      const tickets = await supabase
        .from('att_tickets').select('id').eq('viaje_id', id).is('deleted_at', null);
      if (tickets.error) throw tickets.error;
      const ticketIds = (tickets.data ?? []).map((t) => t.id);

      const [segmentos, hoteles, paradas] = await Promise.all([
        ticketIds.length > 0
          ? supabase
              .from('att_ticket_segments')
              .select('origen_ciudad, origen_iata, destino_ciudad, destino_iata, fecha, fecha_llegada, orden')
              .in('ticket_id', ticketIds)
              .is('deleted_at', null)
          : Promise.resolve({ data: [], error: null } as const),
        supabase.from('att_hoteles').select('ciudad, checkin')
          .eq('viaje_id', id).is('deleted_at', null),
        supabase.from('att_viaje_paradas').select('nombre, fecha_ini, fecha_fin, orden')
          .eq('viaje_id', id).is('deleted_at', null),
      ]);
      for (const r of [segmentos, hoteles, paradas]) {
        if (r.error) throw r.error;
      }

      // 1 · Los vuelos mandan. Se ordenan por fecha y, dentro del día, por el
      //     orden con el que se capturaron los tramos.
      const tramos = [...(segmentos.data ?? [])]
        .filter((s) => s.fecha)
        .sort((a, b) => {
          const f = String(a.fecha).localeCompare(String(b.fecha));
          return f !== 0 ? f : (a.orden ?? 0) - (b.orden ?? 0);
        });

      const pasos: PasoRuta[] = [];
      const fechasOcupadas = new Set<string>();

      for (const t of tramos) {
        const ciudad = ciudadDe(t.destino_ciudad, t.destino_iata);
        const fecha = t.fecha_llegada ?? t.fecha;
        if (!ciudad || !fecha) continue;
        pasos.push({ ciudad, fecha, hasta: null, origen: 'vuelo' });
        fechasOcupadas.add(fecha);
      }

      // 2 · Los hoteles, solo si ese día no lo cubre ya un vuelo: si no, la
      //     misma escala saldria dos veces con nombres distintos.
      for (const h of hoteles.data ?? []) {
        if (!h.ciudad || !h.checkin || fechasOcupadas.has(h.checkin)) continue;
        pasos.push({ ciudad: h.ciudad.trim(), fecha: h.checkin, hasta: null, origen: 'hotel' });
        fechasOcupadas.add(h.checkin);
      }

      // 3 · Las paradas capturadas a mano, con la misma regla.
      for (const p of paradas.data ?? []) {
        if (!p.nombre || !p.fecha_ini || fechasOcupadas.has(p.fecha_ini)) continue;
        pasos.push({
          ciudad: p.nombre.trim(), fecha: p.fecha_ini, hasta: p.fecha_fin, origen: 'parada',
        });
        fechasOcupadas.add(p.fecha_ini);
      }

      pasos.sort((a, b) => a.fecha.localeCompare(b.fecha));

      // 4 · Dos tramos seguidos a la misma ciudad son una sola escala.
      const limpios: PasoRuta[] = [];
      for (const p of pasos) {
        const anterior = limpios[limpios.length - 1];
        if (anterior && clave(anterior.ciudad) === clave(p.ciudad)) {
          anterior.hasta = p.hasta ?? p.fecha;
          continue;
        }
        limpios.push({ ...p });
      }

      const primero = tramos[0];
      return {
        salida: {
          ciudad: primero ? ciudadDe(primero.origen_ciudad, primero.origen_iata) : null,
          fecha: primero?.fecha ?? null,
        },
        pasos: limpios,
      };
    },
  });
}
