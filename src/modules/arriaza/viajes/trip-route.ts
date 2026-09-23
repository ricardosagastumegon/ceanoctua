// La ruta del viaje, en el orden en que de verdad ocurre.
//
// El problema que resuelve: el riel lateral se armaba con `att_viaje_ciudades`,
// que es una lista sin fechas -- ahí solo se sabe *a qué ciudades* va el viaje,
// no *cuándo* se llega a cada una. Con Miami y Nueva York capturadas en un
// orden o en el contrario, el riel las mostraba como viniera, y un viaje que
// pasa primero por Miami se veía al revés.
//
// Quién le pone la fecha a cada ciudad, en orden de importancia (criterio del
// usuario, 2026-09-23):
//
//   1. EL HOTEL. La ciudad que merece mencionarse es donde uno se aloja, así
//      que si hay hotel, su check-in manda.
//   2. EL TOUR. Si no se duerme ahí pero se hace algo, esa es la fecha.
//   3. LA PARADA capturada a mano en el viaje, que además trae hasta cuándo.
//   4. EL VUELO, al final. Sirve para las escalas: en el viaje a Nueva York,
//      Miami aparece solo porque se pasa por ahí antes del vuelo del día
//      siguiente. Pero basta con agregarle un hotel para que la fecha de la
//      ciudad pase a ser la del check-in.
//
// Dos reglas de limpieza, las dos con la misma jerarquía:
//
//   · Una ciudad aparece una sola vez, con la fecha de su fuente más
//     importante.
//   · Un día trae una sola ciudad, la de la fuente más importante. Es lo que
//     evita que el hotel "Brooklyn NY" y el vuelo a "Nueva York" del mismo día
//     salgan como dos escalas distintas.
//
// Lo que NO alimenta el riel es `att_viaje_ciudades`. Una ciudad sin fecha no
// tiene lugar en una línea de tiempo, y colgarla al final duplicaba la misma
// escala cuando está escrita distinto que en el servicio -- "New York" a mano
// contra "Nueva York" del aeropuerto JFK. Esas ciudades se siguen viendo en
// "Datos del viaje", donde la lista no promete ningún orden.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { findAirport } from '../constants/airports';

export type OrigenRuta = 'hotel' | 'tour' | 'parada' | 'vuelo';

/** Menor número, más manda. El orden es el criterio del usuario. */
const PRIORIDAD: Record<OrigenRuta, number> = {
  hotel: 1,
  tour: 2,
  parada: 3,
  vuelo: 4,
};

export type PasoRuta = {
  ciudad: string;
  /** 'YYYY-MM-DD'. Todo paso del riel tiene fecha; de eso se trata. */
  fecha: string;
  /** Hasta cuándo, cuando la fuente lo sabe. */
  hasta: string | null;
  origen: OrigenRuta;
};

export type RutaViaje = {
  /** De dónde sale el viaje, según el primer vuelo. */
  salida: { ciudad: string | null; fecha: string | null };
  /**
   * El vuelo de vuelta a casa, cuando lo hay. Se separa de los pasos para no
   * mostrar la ciudad de origen otra vez justo encima del hito "Regreso".
   */
  regreso: { ciudad: string | null; fecha: string | null } | null;
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

      const [segmentos, hoteles, tours, paradas] = await Promise.all([
        ticketIds.length > 0
          ? supabase
              .from('att_ticket_segments')
              .select('origen_ciudad, origen_iata, destino_ciudad, destino_iata, fecha, fecha_llegada, orden')
              .in('ticket_id', ticketIds)
              .is('deleted_at', null)
          : Promise.resolve({ data: [], error: null } as const),
        supabase.from('att_hoteles').select('ciudad, checkin, checkout')
          .eq('viaje_id', id).is('deleted_at', null),
        supabase.from('att_tours').select('ciudad, fecha')
          .eq('viaje_id', id).is('deleted_at', null),
        supabase.from('att_viaje_paradas').select('nombre, fecha_ini, fecha_fin, orden')
          .eq('viaje_id', id).is('deleted_at', null),
      ]);
      for (const r of [segmentos, hoteles, tours, paradas]) {
        if (r.error) throw r.error;
      }

      const candidatos: PasoRuta[] = [];

      // 1 · Los hoteles mandan: la ciudad donde se duerme es la que importa.
      for (const h of hoteles.data ?? []) {
        if (!h.ciudad || !h.checkin) continue;
        candidatos.push({
          ciudad: h.ciudad.trim(), fecha: h.checkin, hasta: h.checkout, origen: 'hotel',
        });
      }

      // 2 · Los tours, para las ciudades donde no se duerme pero se hace algo.
      for (const t of tours.data ?? []) {
        if (!t.ciudad || !t.fecha) continue;
        candidatos.push({ ciudad: t.ciudad.trim(), fecha: t.fecha, hasta: null, origen: 'tour' });
      }

      // 3 · Las paradas capturadas a mano en el viaje.
      for (const p of paradas.data ?? []) {
        if (!p.nombre || !p.fecha_ini) continue;
        candidatos.push({
          ciudad: p.nombre.trim(), fecha: p.fecha_ini, hasta: p.fecha_fin, origen: 'parada',
        });
      }

      // 4 · Los vuelos al final: cubren las escalas que ningún otro servicio
      //     menciona. Se ordenan por fecha y, dentro del día, por el orden con
      //     el que se capturaron los tramos.
      const tramos = [...(segmentos.data ?? [])]
        .filter((s) => s.fecha)
        .sort((a, b) => {
          const f = String(a.fecha).localeCompare(String(b.fecha));
          return f !== 0 ? f : (a.orden ?? 0) - (b.orden ?? 0);
        });
      for (const t of tramos) {
        const ciudad = ciudadDe(t.destino_ciudad, t.destino_iata);
        const fecha = t.fecha_llegada ?? t.fecha;
        if (!ciudad || !fecha) continue;
        candidatos.push({ ciudad, fecha, hasta: null, origen: 'vuelo' });
      }

      // Se resuelve por jerarquía: primero los hoteles, después los tours, y
      // así. Dentro de cada nivel, lo más temprano primero.
      candidatos.sort((a, b) => {
        const p = PRIORIDAD[a.origen] - PRIORIDAD[b.origen];
        return p !== 0 ? p : a.fecha.localeCompare(b.fecha);
      });

      const ciudadesTomadas = new Set<string>();
      const fechasTomadas = new Set<string>();
      const pasos: PasoRuta[] = [];
      for (const c of candidatos) {
        if (ciudadesTomadas.has(clave(c.ciudad)) || fechasTomadas.has(c.fecha)) continue;
        pasos.push(c);
        ciudadesTomadas.add(clave(c.ciudad));
        fechasTomadas.add(c.fecha);
      }

      pasos.sort((a, b) => a.fecha.localeCompare(b.fecha));

      const primero = tramos[0];
      const ciudadSalida = primero ? ciudadDe(primero.origen_ciudad, primero.origen_iata) : null;

      // Volver a casa no es una escala más: si el último paso es un vuelo de
      // regreso a la ciudad de salida, se saca de la lista y pasa a ser el
      // hito del final. Si no, decir "Ciudad de Guatemala" y debajo "Regreso"
      // es decir dos veces lo mismo.
      let regreso: RutaViaje['regreso'] = null;
      const ultimo = pasos[pasos.length - 1];
      if (
        ultimo && ciudadSalida &&
        ultimo.origen === 'vuelo' &&
        clave(ultimo.ciudad) === clave(ciudadSalida)
      ) {
        regreso = { ciudad: ultimo.ciudad, fecha: ultimo.fecha };
        pasos.pop();
      }

      return {
        salida: { ciudad: ciudadSalida, fecha: primero?.fecha ?? null },
        regreso,
        pasos,
      };
    },
  });
}
