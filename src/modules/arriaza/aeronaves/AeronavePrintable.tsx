import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { totalTarifaExtras, type AttAeronave } from './full-api';

const META = SERVICE_META.aeronave;

type Props = {
  open: boolean;
  onClose: () => void;
  aeronave: AttAeronave;
  tripNo?: string | null;
};

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);

/** Hoja imprimible de la renta de aeronave: la nave, la ruta y el costo. */
export function AeronavePrintable({ open, onClose, aeronave: a, tripNo }: Props) {
  const moneda = a.moneda ?? 'USD';
  const total = totalTarifaExtras(a.tarifa, a.monto_extras);
  const hora = hhmm(a.hora);

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="aeronave"
      band={a.fecha ? <span>{fmtDate(a.fecha)}</span> : null}
      title={a.prestador}
      subtitle={[a.tipo_aeronave, a.ciudad, a.tipo_servicio].filter(Boolean).join(' · ')}
      tripNo={tripNo}
      headerRight={hora ? <span>{hora}</span> : null}
      total={total}
      moneda={moneda}
      estadoPago={a.estado_pago}
      pagadoCon={a.pagado_con}
      confirmacion={a.confirmacion}
      cancelacion={a.cancelacion}
      rows={[
        { label: 'Prestador de servicios', value: a.prestador },
        { label: 'Teléfono', value: a.telefono ?? '—' },
        { label: 'Dirección', value: a.direccion ?? '—' },
        { label: 'Reservado a través de', value: a.reservado ?? '—' },
        { label: 'Reserva a nombre de', value: a.reserva_nombre ?? '—' },
        { label: 'Estatus del pago', value: a.estatus_pago ?? '—' },
      ]}
      extras={
        <div className="space-y-5">
          {/* La aeronave · lo que se contrató. */}
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
            <div
              className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ backgroundColor: META.dark }}
            >
              {META.icon} Aeronave
            </div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 px-4 py-3 text-[12px]">
              {[
                ['Tipo de aeronave', a.tipo_aeronave],
                ['Capacidad', a.capacidad],
                ['Tipo de servicio', a.tipo_servicio],
              ].map(([label, valor]) => (
                <div key={String(label)}>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                    {label}
                  </div>
                  <div className="text-dark">{valor ? String(valor) : '—'}</div>
                </div>
              ))}
            </div>
            {a.descripcion && (
              <div className="border-t px-4 py-2 text-[12px] text-dark-2" style={{ borderColor: META.light }}>
                {a.descripcion}
              </div>
            )}
          </div>

          {/* La ruta · es lo que se lee con la hoja en la mano. */}
          <div
            className="rounded-lg border-l-4 px-5 py-4"
            style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
              Ruta
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                  Origen
                </div>
                <div className="font-heading text-lg font-extrabold text-dark">{a.origen || '—'}</div>
              </div>
              <div className="shrink-0 text-center" style={{ color: META.solid }}>
                <div className="text-xl leading-none">{META.icon}</div>
                <div className="mt-0.5 text-[10px] font-extrabold">{hora ?? ''}</div>
              </div>
              <div className="flex-1 text-right">
                <div className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                  Destino
                </div>
                <div className="font-heading text-lg font-extrabold text-dark">{a.destino || '—'}</div>
              </div>
            </div>
            <div className="mt-2 text-[12px] text-dark-2">
              {a.fecha ? fmtDate(a.fecha) : 'Sin fecha'}
              {hora ? ` · ${hora}` : ''}
            </div>
          </div>

          {a.inclusiones && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                Inclusiones
              </div>
              <div className="text-[12px] text-dark-2">{a.inclusiones}</div>
            </div>
          )}

          <div>
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
              Montos
            </div>
            {[
              ['Tarifa de servicio', Number(a.tarifa) || 0],
              [a.extras || 'Extras', Number(a.monto_extras) || 0],
            ].map(([label, monto], i) => (
              <div key={i} className="flex justify-between border-b border-sand py-1 text-[12px]">
                <span className="text-dark">{String(label)}</span>
                <span className="font-extrabold" style={{ color: META.dark }}>
                  {moneda} {Number(monto).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
