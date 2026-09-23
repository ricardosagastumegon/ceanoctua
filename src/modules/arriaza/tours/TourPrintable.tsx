import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { totalTour, type AttTour } from './full-api';

const META = SERVICE_META.tours;

type Props = {
  open: boolean;
  onClose: () => void;
  tour: AttTour;
  tripNo?: string | null;
};

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);

/** Hoja imprimible del tour: cuándo es, qué incluye y cuánto cuesta. */
export function TourPrintable({ open, onClose, tour: t, tripNo }: Props) {
  const moneda = t.moneda ?? 'USD';
  const total = totalTour(t.tarifa, t.personas);
  const inicio = hhmm(t.hora);
  const fin = hhmm(t.hora_fin);

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="tours"
      band={t.fecha ? <span>{fmtDate(t.fecha)}</span> : null}
      title={t.nombre || t.prestador}
      subtitle={[t.nombre ? t.prestador : null, t.ciudad, t.tipo_servicio]
        .filter(Boolean).join(' · ')}
      tripNo={tripNo}
      headerRight={
        inicio ? (
          <span>
            {inicio}
            {fin ? ` — ${fin}` : ''}
          </span>
        ) : null
      }
      total={total}
      moneda={moneda}
      estadoPago={t.estado_pago}
      pagadoCon={t.pagado_con}
      confirmacion={t.confirmacion}
      cancelacion={t.cancelacion}
      rows={[
        { label: 'Prestador de servicios', value: t.prestador },
        { label: 'Teléfono', value: t.telefono ?? '—' },
        { label: 'Dirección', value: t.direccion ?? '—' },
        { label: 'Reservado a través de', value: t.reservado ?? '—' },
        { label: 'Reserva a nombre de', value: t.reserva_nombre ?? '—' },
        { label: 'Estatus del pago', value: t.estatus_pago ?? '—' },
      ]}
      extras={
        <div className="space-y-5">
          {/* El tour · lo que se contrató. */}
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
            <div
              className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ backgroundColor: META.dark }}
            >
              {META.icon} El tour
            </div>
            <div className="grid grid-cols-4 gap-x-4 gap-y-2 px-4 py-3 text-[12px]">
              {[
                ['Tipo de servicio', t.tipo_servicio],
                ['Duración', t.duracion],
                ['Días', t.dias],
                ['Personas', t.personas],
              ].map(([label, valor]) => (
                <div key={String(label)}>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                    {label}
                  </div>
                  <div className="text-dark">{valor != null && valor !== '' ? String(valor) : '—'}</div>
                </div>
              ))}
            </div>
            {t.descripcion && (
              <div className="border-t px-4 py-2 text-[12px] text-dark-2" style={{ borderColor: META.light }}>
                {t.descripcion}
              </div>
            )}
          </div>

          {/* Cuándo y qué incluye, lado a lado: es lo que se consulta el día del tour. */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className="rounded-lg border-l-4 px-4 py-3"
              style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                🕘 Horario
              </div>
              <div className="mt-1 font-heading text-base font-extrabold" style={{ color: META.dark }}>
                {t.fecha ? fmtDate(t.fecha) : '—'}
              </div>
              <div className="mt-0.5 text-[12px] text-dark-2">
                {inicio ? `Inicio ${inicio}` : 'Sin hora de inicio'}
                {fin ? ` · Fin ${fin}` : ''}
              </div>
              {t.duracion && (
                <div className="mt-0.5 text-[12px] text-dark-2">Duración: {t.duracion}</div>
              )}
            </div>

            <div
              className="rounded-lg border-l-4 px-4 py-3"
              style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                ✅ Incluye
              </div>
              <div className="mt-1 text-[12px] text-dark-2">{t.inclusiones || '—'}</div>
              <div className="mt-1 text-[12px]" style={{ color: META.dark }}>
                <b>Alimentación:</b>{' '}
                {t.incluye_alimentacion
                  ? t.alimentacion_detalle || 'Sí'
                  : 'No incluye'}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
              Montos
            </div>
            <div className="flex justify-between border-b border-sand py-1 text-[12px]">
              <span className="text-dark">
                Tarifa por persona × {t.personas ?? 0}
              </span>
              <span className="font-extrabold" style={{ color: META.dark }}>
                {moneda} {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      }
    />
  );
}
