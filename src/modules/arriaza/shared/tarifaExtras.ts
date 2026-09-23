// Total de los servicios que cobran tarifa + extras.
//
// Aeronave, traslado acuático y ferry comparten la misma fórmula del documento:
// "Total de la reserva: sumatoria de Total de Servicio + Monto de Extras".
// Vive aquí para que las tres la lean del mismo lugar y no se desincronicen.

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function totalTarifaExtras(
  tarifa: string | number | null | undefined,
  montoExtras: string | number | null | undefined,
): number {
  return num(tarifa) + num(montoExtras);
}
