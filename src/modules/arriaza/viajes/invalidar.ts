// Todo lo que la pantalla del viaje deriva de sus servicios.
//
// Cada una de estas queries lee los servicios del viaje y calcula algo: el
// total por servicio, los cuatro números del encabezado, la ruta del riel y
// los eventos del itinerario. Ninguna se entera sola de que se agregó, cambió
// o borró un servicio.
//
// Antes cada formulario invalidaba a mano las dos que conocía, y las dos que
// vinieron después -- los números y la ruta -- se quedaban en caché: un viaje
// con dos vuelos seguía diciendo "1 vuelo" hasta recargar la página. Por eso
// vive aquí una sola función: quien toque un servicio la llama y no tiene que
// acordarse de la lista.

import type { QueryClient } from '@tanstack/react-query';

export function invalidarViaje(qc: QueryClient, viajeId: string): void {
  for (const key of [
    'att_service_counts',
    'att_trip_stats',
    'att_trip_route',
    'att_itinerary_events',
  ]) {
    void qc.invalidateQueries({ queryKey: [key, viajeId] });
  }
}
