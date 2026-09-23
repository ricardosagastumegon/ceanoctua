import { useQuery } from '@tanstack/react-query';
import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { hotelFullApi, totalHabitacion, type AttHotel } from './full-api';

const META = SERVICE_META.hotel;

type Props = {
  open: boolean;
  onClose: () => void;
  hotel: AttHotel;
  tripNo?: string | null;
};

/**
 * Hoja imprimible del hotel.
 *
 * La franja de fechas va arriba del todo y el nombre del hotel grande debajo:
 * es lo que el usuario busca primero al tener la hoja en la mano.
 */
export function HotelPrintable({ open, onClose, hotel, tripNo }: Props) {
  const full = useQuery({
    queryKey: ['att_hotel_full', hotel.id],
    queryFn: () => hotelFullApi.load(hotel.id),
    enabled: open,
  });
  const habitaciones = full.data?.habitaciones ?? [];
  const extras = full.data?.extras ?? [];
  const moneda = hotel.moneda ?? 'USD';
  const noches = hotel.nights ?? 0;

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="hotel"
      band={
        hotel.checkin && hotel.checkout ? (
          <span>
            {fmtDate(hotel.checkin)} <span className="opacity-60">→</span> {fmtDate(hotel.checkout)}
          </span>
        ) : null
      }
      title={hotel.nombre}
      subtitle={[hotel.ciudad, noches ? `${noches} noche${noches === 1 ? '' : 's'}` : null]
        .filter(Boolean)
        .join(' · ')}
      tripNo={tripNo}
      total={hotel.monto != null ? Number(hotel.monto) : null}
      moneda={moneda}
      estadoPago={hotel.estado_pago}
      pagadoCon={hotel.pagado_con}
      confirmacion={hotel.confirmacion}
      cancelacion={hotel.cancel_policy}
      rows={[
        { label: 'Ciudad', value: hotel.ciudad ?? '—' },
        { label: 'Teléfono', value: hotel.telefono ?? '—' },
        { label: 'Dirección', value: hotel.direccion ?? '—' },
        { label: 'Reservado a través de', value: hotel.reservado_por ?? '—' },
        { label: 'Noches', value: noches || '—' },
        { label: 'Early check-in', value: hotel.early_checkin ?? '—' },
        { label: 'Estatus de pago', value: hotel.estatus_pago ?? '—' },
        { label: 'Habitaciones', value: habitaciones.length || '—' },
      ]}
      extras={
        <div className="space-y-5">
          {/* Los dos momentos del hospedaje, lado a lado. */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { titulo: '🔑 Check-in', fecha: hotel.checkin, nota: hotel.early_checkin },
              { titulo: '🏁 Check-out', fecha: hotel.checkout, nota: null },
            ].map((m) => (
              <div
                key={m.titulo}
                className="rounded-lg border-l-4 px-4 py-3"
                style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                  {m.titulo}
                </div>
                <div className="mt-1 font-heading text-base font-extrabold" style={{ color: META.dark }}>
                  {m.fecha ? fmtDate(m.fecha) : '—'}
                </div>
                {m.nota && <div className="mt-0.5 text-[12px] text-dark-2">{m.nota}</div>}
              </div>
            ))}
          </div>

          {/* Las habitaciones son lo que se verifica al llegar al hotel, así que
              van en un panel con cabecera de color y filas alternadas, no como
              una tabla suelta que se pierde entre el resto. */}
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
            <div
              className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ backgroundColor: META.dark }}
            >
              🛏 Habitaciones · {habitaciones.length}
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ backgroundColor: META.light, color: META.dark }} className="text-left">
                  <th className="px-4 py-1.5 font-extrabold">Reserva a nombre de</th>
                  <th className="px-2 py-1.5 font-extrabold">Tipo</th>
                  <th className="px-2 py-1.5 font-extrabold">Pax</th>
                  <th className="px-2 py-1.5 font-extrabold">Desayuno</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Tarifa</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Noches</th>
                  <th className="px-4 py-1.5 text-right font-extrabold">Total</th>
                </tr>
              </thead>
              <tbody>
                {habitaciones.map((h, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                    <td className="px-4 py-1.5 font-semibold text-dark">{h.reserva_nombre || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{h.tipo_hab || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{h.pax || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{h.desayuno || '—'}</td>
                    <td className="px-2 py-1.5 text-right text-dark-2">{h.tarifa || '—'}</td>
                    <td className="px-2 py-1.5 text-right text-dark-2">{h.noches || '—'}</td>
                    <td className="px-4 py-1.5 text-right font-extrabold" style={{ color: META.dark }}>
                      {moneda} {totalHabitacion(h).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {extras.length > 0 && (
            <div>
              <div
                className="mb-2 text-[11px] font-extrabold uppercase tracking-wider"
                style={{ color: META.dark }}
              >
                Servicios extras
              </div>
              {extras.map((e, i) => (
                <div key={i} className="flex justify-between border-b border-sand py-1 text-[12px]">
                  <span className="text-dark">{e.nombre || '—'}</span>
                  <span className="font-extrabold" style={{ color: META.dark }}>
                    {moneda} {(Number(e.monto) || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hotel.comentarios && (
            <div
              className="rounded-md border-l-4 px-3 py-2 text-[12px] text-dark"
              style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
            >
              <b style={{ color: META.dark }}>Comentarios:</b> {hotel.comentarios}
            </div>
          )}
        </div>
      }
    />
  );
}
