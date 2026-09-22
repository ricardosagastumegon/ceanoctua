import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { useTicketCompleto } from './full-hooks';
import type { AttTicket } from './api';

const META = SERVICE_META.tickets;

type Props = {
  open: boolean;
  onClose: () => void;
  ticket: AttTicket;
  tripNo?: string | null;
};

/** Vista previa imprimible de un ticket aéreo, con su ruta y sus pasajeros. */
export function TicketPrintable({ open, onClose, ticket, tripNo }: Props) {
  const full = useTicketCompleto(open ? ticket.id : undefined);
  const segmentos = full.data?.segmentos ?? [];
  const pax = full.data?.pax ?? [];
  const pnrs = full.data?.pnrs ?? [];
  const moneda = ticket.moneda ?? 'USD';

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="tickets"
      title={ticket.titulo ?? `${ticket.origen ?? '?'} → ${ticket.destino ?? '?'}`}
      subtitle={ticket.aerolinea}
      tripNo={tripNo}
      total={ticket.monto != null ? Number(ticket.monto) : null}
      moneda={moneda}
      estadoPago={ticket.estatus_pago}
      pagadoCon={ticket.pagado_con}
      rows={[
        { label: 'Línea aérea', value: ticket.aerolinea ?? '—' },
        { label: 'Reservado a través de', value: ticket.reservado_por ?? '—' },
        { label: 'Categoría', value: ticket.categoria ?? '—' },
        {
          label: 'Tipo de ticket',
          value: ticket.tipo_ticket
            ? `${ticket.tipo_ticket} — ${ticket.tipo_ticket === 'OW' ? 'Solo ida' : 'Ida y vuelta'}`
            : '—',
        },
        {
          label: 'PNR',
          value: pnrs.length ? <span className="font-mono font-extrabold">{pnrs.join(' · ')}</span> : '—',
        },
        {
          label: 'Vuelo',
          value: ticket.vuelo_directo === false
            ? `Con escala${ticket.num_escalas ? ` · ${ticket.num_escalas}` : ''}`
            : 'Directo',
        },
        {
          label: 'Check-in',
          value: ticket.checkin_ini
            ? `${ticket.checkin_ini.slice(0, 5)} — ${ticket.checkin_fin?.slice(0, 5) ?? ''}`
            : '—',
        },
        {
          label: 'Forma de pago',
          value: ticket.formas_pago?.length ? ticket.formas_pago.join(' · ') : '—',
        },
      ]}
      extras={
        <div className="space-y-5">
          {/* Ruta */}
          <div>
            <div
              className="mb-2 text-[11px] font-extrabold uppercase tracking-wider"
              style={{ color: META.dark }}
            >
              Ruta
            </div>
            {segmentos.length === 0 && <p className="text-xs italic text-dark-3">Sin segmentos.</p>}
            {segmentos.map((s, i) => (
              <div
                key={i}
                className="mb-1 rounded-md border-l-4 px-3 py-2"
                style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-heading text-sm font-extrabold" style={{ color: META.dark }}>
                    {s.origen_iata || '?'} → {s.destino_iata || '?'}
                  </span>
                  {s.direccion === 'retorno' && (
                    <span className="rounded-full bg-white px-2 text-[9px] font-extrabold uppercase text-dark-3">
                      retorno
                    </span>
                  )}
                  {s.numero_vuelo && <span className="font-mono text-[11px] text-dark-2">{s.numero_vuelo}</span>}
                </div>
                <div className="text-[11px] text-dark-3">
                  {[
                    s.origen_ciudad && s.destino_ciudad ? `${s.origen_ciudad} — ${s.destino_ciudad}` : null,
                    s.fecha ? `Salida ${fmtDate(s.fecha)}${s.etd ? ` ${s.etd.slice(0, 5)}` : ''}` : null,
                    s.fecha_llegada ? `Llegada ${fmtDate(s.fecha_llegada)}${s.eta ? ` ${s.eta.slice(0, 5)}` : ''}` : null,
                    s.tiempo_vuelo ? `Vuelo ${s.tiempo_vuelo}` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
                {s.escalas.length > 0 && (
                  <div className="mt-1 text-[11px] text-dark-3">
                    Escalas: {s.escalas.map((e) => `${e.iata || '?'}${e.tiempo ? ` (${e.tiempo})` : ''}`).join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pasajeros */}
          <div>
            <div
              className="mb-2 text-[11px] font-extrabold uppercase tracking-wider"
              style={{ color: META.dark }}
            >
              Pasajeros · {pax.length}
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ color: META.dark }} className="text-left">
                  <th className="border-b border-sand py-1">Nombre</th>
                  <th className="border-b border-sand py-1">Tipo</th>
                  <th className="border-b border-sand py-1">Pasaporte</th>
                  <th className="border-b border-sand py-1">Ticket</th>
                  <th className="border-b border-sand py-1">Asiento</th>
                  <th className="border-b border-sand py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {pax.map((p, i) => (
                  <tr key={i}>
                    <td className="border-b border-sand py-1 font-semibold text-dark-2">{p.nombre || '—'}</td>
                    <td className="border-b border-sand py-1 text-dark-3">
                      {p.tipos.join('/') || '—'}
                      {p.nacionalidades.length ? ` · ${p.nacionalidades.join(', ')}` : ''}
                    </td>
                    <td className="border-b border-sand py-1 text-dark-3">{p.pasaporte_num || '—'}</td>
                    <td className="border-b border-sand py-1 text-dark-3">{p.numero_ticket || '—'}</td>
                    <td className="border-b border-sand py-1 text-dark-3">{p.asiento || '—'}</td>
                    <td className="border-b border-sand py-1 text-right font-extrabold" style={{ color: META.dark }}>
                      {moneda} {((Number(p.tarifa) || 0) + (Number(p.extras) || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pax.some((p) => p.eq_personal || p.eq_carryon || p.eq_documentado) && (
              <div className="mt-2 text-[11px] text-dark-3">
                {pax.map((p, i) =>
                  p.eq_personal || p.eq_carryon || p.eq_documentado ? (
                    <div key={i}>
                      <b>{p.nombre}</b> · equipaje:{' '}
                      {[p.eq_personal && `personal ${p.eq_personal}`,
                        p.eq_carryon && `carry on ${p.eq_carryon}`,
                        p.eq_documentado && `documentado ${p.eq_documentado}`]
                        .filter(Boolean).join(' · ')}
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>

          {ticket.penalidad_desc && (
            <div className="rounded-md border border-sand px-3 py-2 text-[11px] text-dark-3">
              <b>Penalidad por cambios:</b> {ticket.penalidad_desc}
              {ticket.penalidad_monto != null ? ` — ${moneda} ${Number(ticket.penalidad_monto).toFixed(2)}` : ''}
            </div>
          )}
        </div>
      }
    />
  );
}
