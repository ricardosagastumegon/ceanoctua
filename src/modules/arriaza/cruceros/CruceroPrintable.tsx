import { useQuery } from '@tanstack/react-query';
import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import {
  cruceroFullApi, cruceroKeys, pendienteCamarote, sumaMovimientos, totalCamarote,
  type AttCrucero, type CamaroteInput,
} from './full-api';

const META = SERVICE_META.crucero;

type Props = {
  open: boolean;
  onClose: () => void;
  crucero: AttCrucero;
  tripNo?: string | null;
};

const hhmm = (v: string | null | undefined): string => (v ? v.slice(0, 5) : '');

/** Fecha con hora cuando la hay: «12 mar 2026 · 17:00». */
function cuando(fecha: string | null, hora: string | null): string {
  if (!fecha) return '—';
  const h = hhmm(hora);
  return h ? `${fmtDate(fecha)} · ${h}` : fmtDate(fecha);
}

/**
 * Hoja imprimible del crucero.
 *
 * A diferencia de los otros servicios, acá el estado de pago no es un dato del
 * encabezado sino el resultado de sumar los abonos de cada camarote. La hoja
 * lo muestra camarote por camarote porque es lo que se revisa cuando la
 * naviera pide el siguiente abono.
 */
export function CruceroPrintable({ open, onClose, crucero, tripNo }: Props) {
  const full = useQuery({
    queryKey: cruceroKeys.full(crucero.id),
    queryFn: () => cruceroFullApi.load(crucero.id),
    enabled: open,
  });
  const camarotes = full.data?.camarotes ?? [];
  const moneda = crucero.moneda ?? 'USD';

  const pax = camarotes.reduce((s, c) => s + (Number(c.pax) || 0), 0);
  const reserva = camarotes.reduce((s, c) => s + totalCamarote(c), 0);
  const abonado = camarotes.reduce((s, c) => s + sumaMovimientos(c.movimientos, 'pago'), 0);
  const extras = camarotes.reduce((s, c) => s + sumaMovimientos(c.movimientos, 'extra'), 0);
  const pendiente = reserva - abonado;
  const movimientos = camarotes.flatMap((c) =>
    c.movimientos.map((m) => ({ ...m, camarote: c.camarote || c.reserva_nombre || '—' })),
  );

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="crucero"
      band={
        crucero.salida_fecha || crucero.retorno_fecha ? (
          <span>
            {fmtDate(crucero.salida_fecha)} <span className="opacity-60">→</span>{' '}
            {fmtDate(crucero.retorno_fecha)}
          </span>
        ) : null
      }
      title={crucero.titulo || crucero.ship || 'Crucero'}
      titleSize="grande"
      subtitle={[
        crucero.ship,
        crucero.package_type,
        crucero.noches ? `${crucero.noches} noche${crucero.noches === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' · ')}
      tripNo={tripNo}
      total={crucero.monto != null ? Number(crucero.monto) : null}
      moneda={moneda}
      estadoPago={crucero.estado_pago}
      pagadoCon={crucero.pagado_con}
      confirmacion={crucero.confirmacion}
      cancelacion={crucero.cancelacion}
      rowsLayout="compacto"
      rows={[
        { label: 'Barco', value: crucero.ship ?? '—' },
        { label: 'Tipo de paquete', value: crucero.package_type ?? '—' },
        { label: 'Fecha de reserva', value: fmtDate(crucero.fecha_reserva) },
        { label: 'Noches', value: crucero.noches ?? '—' },
        { label: 'Camarotes', value: camarotes.length || '—' },
        { label: 'Pasajeros', value: pax || '—' },
      ]}
      extras={
        <div className="space-y-5">
          {/* Embarque y desembarque: con la hoja en la mano es lo primero que
              se busca, y la hora importa tanto como el día. */}
          <div className="evitar-corte grid grid-cols-2 gap-4">
            {[
              { titulo: '⚓ Embarque', fecha: crucero.salida_fecha, hora: crucero.salida_hora },
              { titulo: '🏁 Desembarque', fecha: crucero.retorno_fecha, hora: crucero.retorno_hora },
            ].map((m) => (
              <div
                key={m.titulo}
                className="rounded-lg border-l-4 px-4 py-3"
                style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
              >
                <div
                  className="text-[11px] font-extrabold uppercase tracking-wider"
                  style={{ color: META.dark }}
                >
                  {m.titulo}
                </div>
                <div className="mt-1 font-heading text-base font-extrabold" style={{ color: META.dark }}>
                  {cuando(m.fecha, m.hora)}
                </div>
              </div>
            ))}
          </div>

          {/* Los camarotes: lo que se verifica al abordar. */}
          <div className="evitar-corte overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
            <div
              className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ backgroundColor: META.dark }}
            >
              🛳 Camarotes · {camarotes.length}
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ backgroundColor: META.light, color: META.dark }} className="text-left">
                  <th className="px-4 py-1.5 font-extrabold">Reserva a nombre de</th>
                  <th className="px-2 py-1.5 font-extrabold">Cubierta</th>
                  <th className="px-2 py-1.5 font-extrabold">Camarote</th>
                  <th className="px-2 py-1.5 font-extrabold">Tipo</th>
                  <th className="px-2 py-1.5 font-extrabold">Alimentación</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Pax</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Tarifa</th>
                  <th className="px-4 py-1.5 text-right font-extrabold">Reserva</th>
                </tr>
              </thead>
              <tbody>
                {camarotes.map((c, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                    <td className="px-4 py-1.5 font-semibold text-dark">{c.reserva_nombre || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{c.cubierta || '—'}</td>
                    <td className="px-2 py-1.5 font-mono text-dark-2">{c.camarote || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{c.tipo_hab || '—'}</td>
                    <td className="px-2 py-1.5 text-dark-2">{c.alimentacion || '—'}</td>
                    <td className="px-2 py-1.5 text-right text-dark-2">{c.pax || '—'}</td>
                    <td className="px-2 py-1.5 text-right text-dark-2">{c.tarifa || '—'}</td>
                    <td className="px-4 py-1.5 text-right font-extrabold" style={{ color: META.dark }}>
                      {moneda} {totalCamarote(c).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Estado de la reserva. Es lo propio del crucero: se paga en abonos
              y hay que poder decir de un vistazo cuánto falta. */}
          <div className="evitar-corte grid grid-cols-4 gap-3">
            {[
              { rotulo: 'Reserva', valor: reserva, color: META.dark },
              { rotulo: 'Abonado', valor: abonado, color: '#0f766e' },
              { rotulo: 'Pendiente', valor: pendiente, color: pendiente > 0.005 ? '#b4460f' : '#0f766e' },
              { rotulo: 'Servicios extra', valor: extras, color: META.dark },
            ].map((k) => (
              <div
                key={k.rotulo}
                className="rounded-lg border px-3 py-2 text-center"
                style={{ borderColor: META.solid }}
              >
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">
                  {k.rotulo}
                </div>
                <div className="font-heading text-sm font-extrabold" style={{ color: k.color }}>
                  {moneda} {k.valor.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {movimientos.length > 0 && (
            <div className="evitar-corte overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
              <div
                className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
                style={{ backgroundColor: META.dark }}
              >
                💳 Abonos y servicios extra · {movimientos.length}
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ backgroundColor: META.light, color: META.dark }} className="text-left">
                    <th className="px-4 py-1.5 font-extrabold">Camarote</th>
                    <th className="px-2 py-1.5 font-extrabold">Concepto</th>
                    <th className="px-2 py-1.5 font-extrabold">Fecha</th>
                    <th className="px-2 py-1.5 font-extrabold">Pagado con</th>
                    <th className="px-4 py-1.5 text-right font-extrabold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                      <td className="px-4 py-1.5 font-mono text-dark-2">{m.camarote}</td>
                      <td className="px-2 py-1.5 text-dark">
                        <span
                          className="mr-1.5 rounded px-1 py-0.5 text-[9px] font-extrabold uppercase"
                          style={{
                            backgroundColor: m.clase === 'extra' ? '#fdecd8' : META.light,
                            color: m.clase === 'extra' ? '#b4460f' : META.dark,
                          }}
                        >
                          {m.clase === 'extra' ? 'Extra' : 'Abono'}
                        </span>
                        {m.descripcion || (m.clase === 'extra' ? '—' : 'Abono a la reserva')}
                      </td>
                      <td className="px-2 py-1.5 text-dark-2">{fmtDate(m.fecha_pago)}</td>
                      <td className="px-2 py-1.5 text-dark-2">{m.pagado_con || '—'}</td>
                      <td className="px-4 py-1.5 text-right font-extrabold" style={{ color: META.dark }}>
                        {moneda} {(Number(m.monto) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Lo que falta por camarote, solo cuando falta algo: si está todo
              pagado esta sección no aporta nada a la hoja. */}
          {camarotes.some((c) => pendienteCamarote(c) > 0.005) && (
            <div className="evitar-corte">
              <div
                className="mb-2 text-[11px] font-extrabold uppercase tracking-wider"
                style={{ color: META.dark }}
              >
                Pendiente por camarote
              </div>
              {camarotes
                .filter((c: CamaroteInput) => pendienteCamarote(c) > 0.005)
                .map((c, i) => (
                  <div key={i} className="flex justify-between border-b border-sand py-1 text-[12px]">
                    <span className="text-dark">
                      {c.camarote || '—'}
                      {c.reserva_nombre ? ` · ${c.reserva_nombre}` : ''}
                    </span>
                    <span className="font-extrabold" style={{ color: '#b4460f' }}>
                      {moneda} {pendienteCamarote(c).toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {crucero.itinerario && (
            <div className="evitar-corte">
              <div
                className="mb-1 text-[11px] font-extrabold uppercase tracking-wider"
                style={{ color: META.dark }}
              >
                Itinerario del crucero
              </div>
              <div className="whitespace-pre-line text-[12px] leading-relaxed text-dark">
                {crucero.itinerario}
              </div>
            </div>
          )}

          {crucero.notas && (
            <div
              className="evitar-corte rounded-md border-l-4 px-3 py-2 text-[12px] text-dark"
              style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
            >
              <b style={{ color: META.dark }}>Comentarios:</b> {crucero.notas}
            </div>
          )}
        </div>
      }
    />
  );
}
