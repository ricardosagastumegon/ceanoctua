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
        { label: 'Check-in', value: hotel.checkin ? fmtDate(hotel.checkin) : '—' },
        { label: 'Check-out', value: hotel.checkout ? fmtDate(hotel.checkout) : '—' },
        { label: 'Noches', value: noches || '—' },
        { label: 'Early check-in', value: hotel.early_checkin ?? '—' },
        { label: 'Estatus de pago', value: hotel.estatus_pago ?? '—' },
        { label: 'Habitaciones', value: habitaciones.length || '—' },
      ]}
      extras={
        <div className="space-y-5">
          <div>
            <div
              className="mb-2 text-[11px] font-extrabold uppercase tracking-wider"
              style={{ color: META.dark }}
            >
              Habitaciones
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ color: META.dark }} className="text-left">
                  <th className="border-b border-sand py-1">Reserva a nombre de</th>
                  <th className="border-b border-sand py-1">Tipo</th>
                  <th className="border-b border-sand py-1">Pax</th>
                  <th className="border-b border-sand py-1">Desayuno</th>
                  <th className="border-b border-sand py-1 text-right">Tarifa</th>
                  <th className="border-b border-sand py-1 text-right">Noches</th>
                  <th className="border-b border-sand py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {habitaciones.map((h, i) => (
                  <tr key={i}>
                    <td className="border-b border-sand py-1 font-semibold text-dark-2">{h.reserva_nombre || '—'}</td>
                    <td className="border-b border-sand py-1 text-dark-3">{h.tipo_hab || '—'}</td>
                    <td className="border-b border-sand py-1 text-dark-3">{h.pax || '—'}</td>
                    <td className="border-b border-sand py-1 text-dark-3">{h.desayuno || '—'}</td>
                    <td className="border-b border-sand py-1 text-right text-dark-3">{h.tarifa || '—'}</td>
                    <td className="border-b border-sand py-1 text-right text-dark-3">{h.noches || '—'}</td>
                    <td className="border-b border-sand py-1 text-right font-extrabold" style={{ color: META.dark }}>
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
                <div key={i} className="flex justify-between border-b border-sand py-1 text-[11px]">
                  <span className="text-dark-2">{e.nombre || '—'}</span>
                  <span className="font-extrabold" style={{ color: META.dark }}>
                    {moneda} {(Number(e.monto) || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hotel.comentarios && (
            <div className="rounded-md border border-sand px-3 py-2 text-[11px] text-dark-3">
              <b>Comentarios:</b> {hotel.comentarios}
            </div>
          )}
        </div>
      }
    />
  );
}
