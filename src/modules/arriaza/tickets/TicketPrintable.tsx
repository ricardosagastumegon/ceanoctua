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

/**
 * "24 SEP" a partir de 'YYYY-MM-DD'.
 *
 * Se parte la cadena en vez de usar `new Date()` porque una fecha sin hora se
 * interpreta como UTC y en Guatemala eso la corre un día hacia atrás.
 */
function diaMes(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${String(d).padStart(2, '0')} ${MESES[m - 1]}`;
}

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
      titleSize="grande"
      rowsLayout="compacto"
      headerRight={
        (() => {
          // La fecha sale del primer segmento; si no hay, del encabezado.
          const salida = diaMes(segmentos[0]?.fecha ?? ticket.fecha_salida);
          const pnr = pnrs[0] ?? ticket.codigo_reserva ?? '';
          if (!salida && !pnr) return null;
          return (
            <>
              {salida}
              {salida && pnr ? ' · ' : ''}
              {pnr ? `PNR: ${pnr}` : ''}
            </>
          );
        })()
      }
      tripNo={tripNo}
      total={ticket.monto != null ? Number(ticket.monto) : null}
      moneda={moneda}
      estadoPago={ticket.estado_pago}
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
          {/* Ruta · el dato principal de la hoja, así que va como pase de
              abordar: origen y destino grandes y el tiempo de vuelo bajo el
              avión. La versión en tabla era ilegible de un vistazo. */}
          <div className="space-y-3">
            {segmentos.length === 0 && <p className="text-xs italic text-dark-3">Sin segmentos.</p>}
            {segmentos.map((sg, i) => (
              <div key={i}>
                <div
                  className="rounded-lg px-5 py-4"
                  style={{ backgroundColor: META.light }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-extrabold uppercase tracking-wider"
                      style={{ color: META.dark }}
                    >
                      Ruta{segmentos.length > 1 ? ` · tramo ${i + 1}` : ''}
                    </span>
                    {sg.direccion === 'retorno' && (
                      <span
                        className="rounded-full bg-white px-2 text-[9px] font-extrabold uppercase"
                        style={{ color: META.dark }}
                      >
                        retorno
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-4">
                    <Extremo
                      iata={sg.origen_iata}
                      ciudad={sg.origen_ciudad}
                      hora={sg.etd}
                    />
                    <div className="shrink-0 text-center">
                      <div className="text-lg leading-none" style={{ color: META.solid }}>
                        ✈&nbsp;→
                      </div>
                      {sg.tiempo_vuelo && (
                        <div className="mt-1 text-[11px] font-extrabold" style={{ color: META.dark }}>
                          {sg.tiempo_vuelo}
                        </div>
                      )}
                      {sg.numero_vuelo && (
                        <div className="text-[10px] font-mono text-dark-3">{sg.numero_vuelo}</div>
                      )}
                    </div>
                    <Extremo
                      iata={sg.destino_iata}
                      ciudad={sg.destino_ciudad}
                      hora={sg.eta}
                      alineado="derecha"
                    />
                  </div>
                </div>

                <div className="mt-1 text-center text-[11px] text-dark-3">
                  {[
                    sg.fecha ? `📅 Salida: ${fmtDate(sg.fecha)}` : null,
                    sg.fecha_llegada && sg.fecha_llegada !== sg.fecha
                      ? `Llegada: ${fmtDate(sg.fecha_llegada)}`
                      : null,
                    i === 0 && ticket.checkin_ini
                      ? `Check-in: ${ticket.checkin_ini.slice(0, 5)} – ${ticket.checkin_fin?.slice(0, 5) ?? ''}`
                      : null,
                    sg.escalas.length
                      ? `Escalas: ${sg.escalas.map((e) => `${e.iata || '?'}${e.tiempo ? ` (${e.tiempo})` : ''}`).join(', ')}`
                      : null,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>

          {/* Pasajeros · panel propio, igual que el vehículo en la renta. */}
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
            <div
              className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ backgroundColor: META.dark }}
            >
              👤 Pasajeros · {pax.length}
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ backgroundColor: META.light, color: META.dark }} className="text-left">
                  <th className="px-4 py-1.5 font-extrabold">Nombre</th>
                  <th className="px-2 py-1.5 font-extrabold">Tipo</th>
                  <th className="px-2 py-1.5 font-extrabold">Pasaporte</th>
                  <th className="px-2 py-1.5 font-extrabold">Ticket</th>
                  <th className="px-2 py-1.5 font-extrabold">Asiento</th>
                  <th className="px-2 py-1.5 font-extrabold" title="Artículo personal · carry on · documentado">
                    Equipaje
                  </th>
                  <th className="whitespace-nowrap px-4 py-1.5 text-right font-extrabold">Total</th>
                </tr>
              </thead>
              <tbody>
                {pax.map((p, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                    <td className="px-4 py-1.5 font-semibold text-dark">{p.nombre || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">
                      {p.tipos.join('/') || '—'}
                      {p.nacionalidades.length ? ` · ${p.nacionalidades.join(', ')}` : ''}
                    </td>
                    <td className="px-2 py-1.5 text-dark-2">{p.pasaporte_num || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{p.numero_ticket || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{p.asiento || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">
                      <Equipaje personal={p.eq_personal} carryon={p.eq_carryon} documentado={p.eq_documentado} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-1.5 text-right" style={{ color: META.dark }}>
                      <span className="text-[9px] font-semibold opacity-70">{moneda}</span>{' '}
                      <span className="font-extrabold">
                        {((Number(p.tarifa) || 0) + (Number(p.extras) || 0)).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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


/** Un extremo del vuelo: código grande, ciudad y hora. */
function Extremo({
  iata, ciudad, hora, alineado = 'izquierda',
}: {
  iata: string;
  ciudad: string;
  hora: string;
  alineado?: 'izquierda' | 'derecha';
}) {
  return (
    <div className={`flex-1 ${alineado === 'derecha' ? 'text-right' : 'text-left'}`}>
      <div
        className="font-heading font-extrabold leading-none"
        style={{ color: META.dark, fontSize: '3.2rem' }}
      >
        {iata || '—'}
      </div>
      {ciudad && <div className="mt-0.5 text-[11px] text-dark-3">{ciudad}</div>}
      {hora && (
        <div className="mt-0.5 text-sm font-extrabold" style={{ color: META.solid }}>
          {hora.slice(0, 5)}
        </div>
      )}
    </div>
  );
}

/**
 * Equipaje en íconos: 👜 artículo personal · 🎒 carry on · 🧳 documentado.
 * Antes iba como párrafos sueltos debajo de la tabla y ocupaba media hoja.
 */
function Equipaje({
  personal, carryon, documentado,
}: {
  personal: string;
  carryon: string;
  documentado: string;
}) {
  const piezas = [
    { icono: '👜', valor: personal, titulo: 'Artículo personal' },
    { icono: '🎒', valor: carryon, titulo: 'Carry on' },
    { icono: '🧳', valor: documentado, titulo: 'Equipaje documentado' },
  ].filter((p) => p.valor && p.valor.trim());
  if (piezas.length === 0) return <span>—</span>;
  return (
    <span className="whitespace-nowrap">
      {piezas.map((p) => (
        <span key={p.titulo} title={p.titulo} className="mr-1.5">
          {p.icono} {p.valor}
        </span>
      ))}
    </span>
  );
}
