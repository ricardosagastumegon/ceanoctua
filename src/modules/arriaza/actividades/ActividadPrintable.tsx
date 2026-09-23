import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { Montos } from '../acuaticos/AcuaticoPrintable';
import { totalActividad, type AttActividad, type AttEntrada } from './full-api';

const META = SERVICE_META.actividades;

type Props = {
  open: boolean;
  onClose: () => void;
  actividad: AttActividad;
  entradas: AttEntrada[];
  tripNo?: string | null;
};

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);

/** Hoja imprimible de la actividad: el evento, quién va y con qué entrada. */
export function ActividadPrintable({ open, onClose, actividad: a, entradas, tripNo }: Props) {
  const moneda = a.moneda ?? 'USD';
  const total = totalActividad(entradas, a.tarifa, a.personas, a.monto_extras);
  const inicio = hhmm(a.inicio);
  const fin = hhmm(a.fin);
  const participantes = (a.participantes ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="actividades"
      band={a.fecha ? <span>{fmtDate(a.fecha)}</span> : null}
      title={a.evento}
      subtitle={[a.ciudad, a.duracion].filter(Boolean).join(' · ')}
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
      estadoPago={a.estado_pago}
      pagadoCon={a.pagado_con}
      confirmacion={a.confirmacion}
      cancelacion={a.cancelacion}
      rows={[
        { label: 'Dirección', value: a.direccion ?? '—' },
        { label: 'Reserva a través de', value: a.reservado ?? '—' },
        { label: 'Reserva a nombre de', value: a.reserva_nombre ?? '—' },
        { label: 'Lugares', value: a.lugares ?? '—' },
        { label: 'Cantidad de personas', value: a.personas != null ? String(a.personas) : '—' },
        { label: 'Estatus del pago', value: a.estatus_pago ?? '—' },
      ]}
      extras={
        <div className="space-y-5">
          {a.descripcion && (
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
              <div
                className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
                style={{ backgroundColor: META.dark }}
              >
                {META.icon} El evento
              </div>
              <div className="px-4 py-3 text-[12px] text-dark-2">{a.descripcion}</div>
            </div>
          )}

          {/* Quiénes van, cuando no hay tabla detallada que ya los liste. */}
          {entradas.length === 0 && participantes.length > 0 && (
            <div
              className="rounded-lg border-l-4 px-4 py-3"
              style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                👥 Participantes
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {participantes.map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold"
                    style={{ color: META.dark }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Los participantes con lo que paga cada uno. El número de ticket
              y el lugar solo se muestran si el evento los maneja. */}
          {entradas.length > 0 && (
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
              <div
                className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
                style={{ backgroundColor: META.dark }}
              >
                {a.tiene_tickets ? '\u{1F3AB} Participantes y entradas' : '\u{1F465} Participantes'}
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ backgroundColor: META.light }}>
                    {['Nombre', ...(a.tiene_tickets ? ['No. de ticket', 'Lugar'] : []), 'Tarifa'].map((h, i, arr) => (
                      <th
                        key={h}
                        className={`px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-wider ${i === arr.length - 1 ? 'text-right' : 'text-left'}`}
                        style={{ color: META.dark }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entradas.map((e) => (
                    <tr key={e.id} className="border-t" style={{ borderColor: META.light }}>
                      <td className="px-4 py-1.5 text-dark">{e.nombre || '\u2014'}</td>
                      {a.tiene_tickets && (
                        <td className="px-4 py-1.5 font-mono font-extrabold" style={{ color: META.dark }}>
                          {e.ticket || '\u2014'}
                        </td>
                      )}
                      {a.tiene_tickets && (
                        <td className="px-4 py-1.5 text-dark-2">{e.lugar || '\u2014'}</td>
                      )}
                      <td className="px-4 py-1.5 text-right font-extrabold" style={{ color: META.dark }}>
                        {moneda} {(Number(e.tarifa) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div
              className="rounded-lg border-l-4 px-4 py-3"
              style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                🕘 Cuándo
              </div>
              <div className="mt-1 font-heading text-base font-extrabold" style={{ color: META.dark }}>
                {a.fecha ? fmtDate(a.fecha) : '—'}
              </div>
              <div className="mt-0.5 text-[12px] text-dark-2">
                {inicio ? `Inicio ${inicio}` : 'Sin hora de inicio'}
                {fin ? ` · Fin ${fin}` : ''}
              </div>
              {a.duracion && <div className="mt-0.5 text-[12px] text-dark-2">Duración: {a.duracion}</div>}
            </div>

            <div
              className="rounded-lg border-l-4 px-4 py-3"
              style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                ✅ Incluye
              </div>
              <div className="mt-1 text-[12px] text-dark-2">{a.inclusiones || '—'}</div>
            </div>
          </div>

          <Montos
            serviceKey="actividades"
            moneda={moneda}
            tarifa={
              entradas.length > 0
                ? entradas.reduce((sum, e) => sum + (Number(e.tarifa) || 0), 0)
                : (Number(a.tarifa) || 0) * (Number(a.personas) || 0)
            }
            etiquetaTarifa={
              entradas.length > 0
                ? `Tarifas de ${entradas.length} participante${entradas.length === 1 ? '' : 's'}`
                : `Tarifa por persona × ${a.personas ?? 0}`
            }
            etiquetaExtras={a.extras || 'Extras'}
            montoExtras={Number(a.monto_extras) || 0}
          />
        </div>
      }
    />
  );
}
