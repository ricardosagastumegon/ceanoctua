import type { Solicitud } from './api';

/**
 * La solicitud de vale, aplanada: justo lo que el formato OL-RG-0175 imprime
 * y ni un campo mas.
 *
 * EXISTE POR EL TESORERO. El no puede leer `comb_solicitudes` --RLS concede
 * por tabla, no por fila enviada, y darle esa tabla seria darle todos los
 * vales de la casa. Lo que ve llega dentro del `snapshot` del envio. Hasta
 * ahora el snapshot llevaba un resumen de cinco campos, asi que el recibia
 * una ficha donde ella tiene un documento. Este es el objeto que viaja para
 * que los dos vean el mismo papel.
 *
 * Al ser el mismo tipo que consume el imprimible, no hay dos versiones del
 * documento que puedan separarse con el tiempo: lo que ella imprime y lo que
 * el abre salen de la misma funcion.
 */
export type DatosVale = {
  fecha?: string | null;
  vale_num?: string | null;
  vale_a?: string | null;
  marca?: string | null;
  placa?: string | null;
  tipo?: string | null;
  departamento?: string | null;
  justificacion?: string | null;
  autorizado_por?: string | null;
  solicitado_por?: string | null;
  monto_autorizado?: number | null;
  kilometraje_actual?: number | null;
  km_ultima_llenada?: number | null;
};

export function datosDeSolicitud(
  s: Solicitud,
  ctx: {
    vehiculo?: { marca: string; placa: string; tipo: string | null } | null;
    autorizador?: string | null;
    solicitante?: string | null;
  },
): DatosVale {
  return {
    fecha: s.fecha,
    vale_num: s.vale_num,
    vale_a: s.vale_a,
    marca: ctx.vehiculo?.marca ?? null,
    // Los cuadros de «vehiculos varios» no tienen carro de catalogo: ahi la
    // placa se escribe a mano en la propia solicitud.
    placa: ctx.vehiculo?.placa ?? s.placa_libre ?? null,
    tipo: ctx.vehiculo?.tipo ?? null,
    departamento: s.departamento,
    justificacion: s.justificacion,
    autorizado_por: ctx.autorizador ?? null,
    solicitado_por: ctx.solicitante ?? null,
    monto_autorizado: s.monto_autorizado,
    kilometraje_actual: s.kilometraje_actual,
    km_ultima_llenada: s.km_ultima_llenada,
  };
}

/** Lo que el objeto guardado en un `snapshot` pueda traer, sin fiarse. */
export function leerDatosVale(x: unknown): DatosVale | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  return x as DatosVale;
}
