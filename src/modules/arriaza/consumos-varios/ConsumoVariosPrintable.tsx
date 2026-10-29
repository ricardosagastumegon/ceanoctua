import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import type { AttConsumoVarios } from './api';

const META = SERVICE_META.varios;

type Props = {
  open: boolean;
  onClose: () => void;
  consumo: AttConsumoVarios;
  tripNo?: string | null;
};

/**
 * Hoja del reporte de consumos varios.
 *
 * Es el papel que se adjunta a la solicitud de reintegro, así que la tarjeta
 * va en el cuerpo y no solo en el pie: una fotocopia en blanco y negro pierde
 * el pie oscuro.
 */
export function ConsumoVariosPrintable({ open, onClose, consumo: c, tripNo }: Props) {
  const moneda = c.moneda ?? 'USD';

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="varios"
      band={c.fecha ? <span>{fmtDate(c.fecha)}</span> : null}
      title={c.concepto}
      subtitle="Gastos menudos del viaje, reportados como un total"
      tripNo={tripNo}
      total={Number(c.monto ?? 0)}
      moneda={moneda}
      estadoPago={c.estado_pago}
      pagadoCon={c.pagado_con}
      rows={[
        { label: 'Concepto', value: c.concepto },
        { label: 'Tarjeta', value: c.pagado_con ?? '—' },
        { label: 'Fecha del reporte', value: c.fecha ? fmtDate(c.fecha) : '—' },
        { label: 'Fecha de cargo a la tarjeta', value: c.fecha_cargo ? fmtDate(c.fecha_cargo) : '—' },
      ]}
      extras={
        (c.notas || c.reporte_path) && (
          <div className="space-y-4">
            {c.notas && (
              <div>
                <div
                  className="mb-1 text-[11px] font-extrabold uppercase tracking-wider"
                  style={{ color: META.dark }}
                >
                  Detalle del reporte
                </div>
                <div className="whitespace-pre-wrap text-[12px] text-dark-2">{c.notas}</div>
              </div>
            )}
            {c.reporte_path && (
              <div className="text-[11px] italic text-dark-3">
                El reporte entregado está adjunto en el sistema.
              </div>
            )}
          </div>
        )
      }
    />
  );
}
