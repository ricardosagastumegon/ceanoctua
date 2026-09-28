import { useQuery } from '@tanstack/react-query';
import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import {
  cruceroFullApi, cruceroKeys, pendienteCamarote, sumaMovimientos, totalCamarote,
  type AttCrucero, type CamaroteInput,
} from './full-api';

const META = SERVICE_META.crucero;
const TEAL = '#0f766e';
const AMBAR = '#b4460f';

type Props = {
  open: boolean;
  onClose: () => void;
  crucero: AttCrucero;
  tripNo?: string | null;
};

const hhmm = (v: string | null | undefined): string => (v ? v.slice(0, 5) : '');
const money = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Fecha con hora cuando la hay: «12 mar 2026 · 17:00». */
function cuando(fecha: string | null, hora: string | null): string {
  if (!fecha) return '—';
  const h = hhmm(hora);
  return h ? `${fmtDate(fecha)} · ${h}` : fmtDate(fecha);
}

/** `Camarote 9204`, o el nombre de la reserva si no se anotó el número. */
const rotulo = (c: CamaroteInput): string =>
  c.camarote ? `Camarote ${c.camarote}` : c.reserva_nombre || 'Camarote';

/**
 * Hoja imprimible del crucero, en dos hojas.
 *
 * La primera es la que se lee: qué camarote es de quién, quién viaja en él y
 * cuánto se lleva pagado. La segunda es el detalle del dinero —cada abono con
 * su tarjeta y su fecha—, que es lo que se revisa cuando la naviera pide el
 * siguiente abono pero estorba cuando solo se quiere ver la reserva.
 *
 * Están separadas a pedido del usuario: la hoja única salía «demasiado
 * saturada».
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
      // El total y el estado van en la banda de la primera hoja, no en el pie
      // de `ServicePrintable`: ese pie quedaría hasta el final de la segunda.
      moneda={moneda}
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
        <div>
          {/* ── HOJA 1 · la reserva ──────────────────────────────────── */}
          <div className="space-y-5">
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

            {/* Lo único que necesita la primera hoja: de quién es cada
                camarote, quién viaja en él y cuánto se lleva pagado. */}
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
                    <th className="px-2 py-1.5 font-extrabold">N.º de reserva</th>
                    <th className="px-2 py-1.5 font-extrabold">Cubierta</th>
                    <th className="px-2 py-1.5 font-extrabold">Camarote</th>
                    <th className="px-2 py-1.5 font-extrabold">Tipo de habitación</th>
                    <th className="px-4 py-1.5 text-right font-extrabold">Monto pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {camarotes.map((c, i) => {
                    const pagado = sumaMovimientos(c.movimientos, 'pago');
                    const totalCam = totalCamarote(c);
                    return (
                      <tr key={i} style={{ backgroundColor: i % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                        <td className="px-4 py-2 align-top">
                          <div className="font-semibold text-dark">{c.reserva_nombre || '—'}</div>
                          {/* Quiénes viajan en ESTE camarote. Sin esto la hoja
                              no dice a quién pertenece cada reserva. */}
                          {c.pasajeros.length > 0 && (
                            <div className="mt-0.5 text-[11px] text-dark-3">
                              {c.pasajeros.join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top font-mono text-dark-2">
                          {c.reserva_numero || '—'}
                        </td>
                        <td className="px-2 py-2 align-top text-dark-2">{c.cubierta || '—'}</td>
                        <td className="px-2 py-2 align-top font-mono text-dark-2">{c.camarote || '—'}</td>
                        <td className="px-2 py-2 align-top text-dark-2">{c.tipo_hab || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right align-top">
                          <div className="font-extrabold" style={{ color: META.dark }}>
                            {moneda} {money(pagado)}
                          </div>
                          {/* Mostrar solo lo pagado escondería una deuda. */}
                          {Math.abs(totalCam - pagado) > 0.005 && (
                            <div className="text-[10px] text-dark-3">de {moneda} {money(totalCam)}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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

            <div
              className="evitar-corte flex items-center justify-between rounded-lg px-5 py-4 text-white"
              style={{ background: META.grad }}
            >
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                  {META.icon} Total del servicio
                </div>
                {crucero.estado_pago && (
                  <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                    Estado: {crucero.estado_pago}
                  </div>
                )}
                {pendiente > 0.005 && (
                  <div className="mt-0.5 text-[10px] text-white/70">
                    Pendiente por abonar: {moneda} {money(pendiente)}
                  </div>
                )}
              </div>
              <div className="font-heading text-2xl font-extrabold">
                {moneda} {money(Number(crucero.monto ?? 0))}
              </div>
            </div>
          </div>

          {/* ── HOJA 2 · el detalle del dinero ───────────────────────── */}
          <div className="salto-pagina pt-8">
            {/* En pantalla no hay salto de hoja, así que la separación tiene
                que verse de alguna manera. */}
            <div className="no-print mb-4 border-t-2 border-dashed border-sand pt-4 text-[10px] font-extrabold uppercase tracking-widest text-dark-3">
              ↓ Segunda hoja
            </div>

            <div className="mb-4">
              <div className="font-heading text-lg font-extrabold" style={{ color: META.dark }}>
                Detalle de pagos
              </div>
              <div className="text-[11px] text-dark-3">
                {crucero.titulo || crucero.ship}
                {tripNo ? ` · ${tripNo}` : ''}
              </div>
            </div>

            <div className="evitar-corte mb-5 grid grid-cols-4 gap-3">
              {[
                { rotulo: 'Reserva', valor: reserva, color: META.dark },
                { rotulo: 'Abonado', valor: abonado, color: TEAL },
                { rotulo: 'Pendiente', valor: pendiente, color: pendiente > 0.005 ? AMBAR : TEAL },
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
                    {moneda} {money(k.valor)}
                  </div>
                </div>
              ))}
            </div>

            {/* Un bloque por camarote: así se ve de una qué se pagó de qué
                reserva, sin tener que cruzar el número de camarote a mano. */}
            <div className="space-y-4">
              {camarotes.map((c, i) => {
                const pagos = sumaMovimientos(c.movimientos, 'pago');
                const extrasCam = sumaMovimientos(c.movimientos, 'extra');
                const falta = pendienteCamarote(c);
                return (
                  <div
                    key={i}
                    className="evitar-corte overflow-hidden rounded-lg border"
                    style={{ borderColor: `${META.solid}66` }}
                  >
                    <div
                      className="flex flex-wrap items-baseline gap-x-3 px-4 py-2"
                      style={{ backgroundColor: META.light }}
                    >
                      <span className="text-[11px] font-extrabold uppercase tracking-wider"
                        style={{ color: META.dark }}>
                        {rotulo(c)}
                      </span>
                      <span className="text-[11px] text-dark-2">
                        {[
                          c.reserva_nombre,
                          c.reserva_numero ? `Reserva ${c.reserva_numero}` : null,
                          c.tipo_hab,
                          c.alimentacion,
                          `${c.pax} pax × ${moneda} ${money(Number(c.tarifa) || 0)}`,
                        ].filter(Boolean).join(' · ')}
                      </span>
                      <span className="ml-auto text-[11px] font-extrabold" style={{ color: META.dark }}>
                        Reserva {moneda} {money(totalCamarote(c))}
                      </span>
                    </div>

                    {c.movimientos.length === 0 ? (
                      <p className="px-4 py-2 text-[11px] italic text-dark-3">
                        Sin abonos ni servicios extra registrados.
                      </p>
                    ) : (
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-left text-dark-3">
                            <th className="px-4 py-1 font-extrabold">Concepto</th>
                            <th className="px-2 py-1 font-extrabold">Fecha de pago</th>
                            <th className="px-2 py-1 font-extrabold">Pagado con</th>
                            <th className="px-4 py-1 text-right font-extrabold">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.movimientos.map((m, k) => (
                            <tr key={k} className="border-t border-sand">
                              <td className="px-4 py-1.5 text-dark">
                                <span
                                  className="mr-1.5 rounded px-1 py-0.5 text-[9px] font-extrabold uppercase"
                                  style={{
                                    backgroundColor: m.clase === 'extra' ? '#fdecd8' : META.light,
                                    color: m.clase === 'extra' ? AMBAR : META.dark,
                                  }}
                                >
                                  {m.clase === 'extra' ? 'Extra' : 'Abono'}
                                </span>
                                {m.descripcion || (m.clase === 'extra' ? '—' : 'Abono a la reserva')}
                                {m.comentario && (
                                  <div className="text-[10px] text-dark-3">{m.comentario}</div>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-2 py-1.5 align-top text-dark-2">
                                {m.fecha_pago ? fmtDate(m.fecha_pago) : '—'}
                              </td>
                              <td className="px-2 py-1.5 align-top text-dark-2">
                                {m.pagado_con || '—'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-1.5 text-right align-top font-extrabold"
                                style={{ color: META.dark }}>
                                {moneda} {money(Number(m.monto) || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div className="flex flex-wrap items-baseline justify-end gap-x-4 border-t px-4 py-1.5 text-[11px]"
                      style={{ borderColor: `${META.solid}33`, backgroundColor: 'rgba(0,0,0,.015)' }}>
                      <span className="font-extrabold" style={{ color: TEAL }}>
                        Abonado {moneda} {money(pagos)}
                      </span>
                      {extrasCam > 0 && (
                        <span className="text-dark-2">
                          Extras {moneda} {money(extrasCam)}
                        </span>
                      )}
                      <span className="font-extrabold"
                        style={{ color: falta > 0.005 ? AMBAR : '#2a6e24' }}>
                        {falta > 0.005
                          ? `Falta ${moneda} ${money(falta)}`
                          : falta < -0.005
                            ? `Sobrepagado ${moneda} ${money(-falta)}`
                            : 'Pagado al 100 %'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      }
    />
  );
}
