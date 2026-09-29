import { PrintableModal } from '@/components/ui/PrintableModal';
import { fmtDate } from '@/modules/arriaza/utils';
import { acento } from '../constants';
import type { Aeronave } from '../api';
import type { RegistroCompleto } from './api';

const money = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  registro: RegistroCompleto;
  aeronave: Aeronave;
  onClose: () => void;
  /** Abre el vale o la factura que se adjuntó. */
  onVerArchivo: () => void;
  /** Abre la solicitud de pago oficial, si ya la generaron. */
  onVerSolicitud: () => void;
  cargandoSolicitud?: boolean;
};

/** Un dato con su rótulo, como en las fichas del resto del módulo. */
function Dato({ label, value, mono, color }: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  color: { dark: string; light: string };
}) {
  return (
    <div>
      <span
        className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
        style={{ backgroundColor: color.light, color: color.dark }}
      >
        {label}
      </span>
      <div className={`mt-1 text-[13px] leading-snug text-dark ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </div>
    </div>
  );
}

/**
 * El registro de combustible completo: sus datos, sus productos, el documento
 * que se adjuntó y su solicitud de pago.
 *
 * Existe porque la fila de la tabla no alcanza. El usuario pidió «un botón
 * donde pueda ver todo, el registro, los documentos cargados y si ya tiene
 * solicitud, la solicitud de pago»: los tres estaban en pantallas distintas.
 *
 * Los botones van con `no-print`: en papel esta hoja es el registro, no una
 * pantalla con controles.
 */
export function RegistroPrintable({
  registro: r, aeronave, onClose, onVerArchivo, onVerSolicitud, cargandoSolicitud,
}: Props) {
  const col = acento(aeronave.acento);
  const anulado = !!r.cancelado_en;
  const pendiente = !!r.notificacion_id && !r.notificacion_procesada && !r.pago_id;

  return (
    <PrintableModal
      open
      onClose={onClose}
      title={`Combustible ${r.serial ?? ''} · ${aeronave.matricula}`}
    >
      <article className="mx-auto max-w-3xl bg-white">
        <header className="px-8 py-6 text-white" style={{ background: col.grad }}>
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/70">
                Control de combustible
              </div>
              <div className="mt-1 font-heading text-3xl font-extrabold">{r.serial ?? 'Registro'}</div>
              <div className="mt-1 text-[13px] font-semibold text-white/80">{fmtDate(r.fecha)}</div>
            </div>
            <div className="text-right">
              <div className="font-heading text-2xl font-extrabold">{aeronave.matricula}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                {aeronave.nombre ?? aeronave.tipo_aeronave ?? ''}
              </div>
            </div>
          </div>
          {anulado && (
            <div className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
              Anulado el {fmtDate(r.cancelado_en)}
              {r.cancelacion_nota ? ` · ${r.cancelacion_nota}` : ''}
            </div>
          )}
        </header>

        <section className="grid grid-cols-4 gap-x-5 gap-y-4 px-8 py-5">
          <Dato label="Vale" value={r.vale} mono color={col} />
          <Dato label="Factura" value={r.factura} mono color={col} />
          <Dato label="FER / AP" value={r.fer_ap} mono color={col} />
          <Dato label="Moneda" value={r.moneda} color={col} />
          <div className="col-span-2">
            <Dato
              label="Entidad"
              value={[r.entidad, r.entidad_nit ? `NIT ${r.entidad_nit}` : null].filter(Boolean).join(' · ')}
              color={col}
            />
          </div>
          <div className="col-span-2">
            <Dato
              label="Proveedor"
              value={[r.proveedor, r.proveedor_nit ? `NIT ${r.proveedor_nit}` : null].filter(Boolean).join(' · ')}
              color={col}
            />
          </div>
        </section>

        <section className="px-8 pb-5">
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: col.solid }}>
            <div
              className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ backgroundColor: col.dark }}
            >
              Productos · {r.lineas.length}
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ backgroundColor: col.light, color: col.dark }} className="text-left">
                  <th className="px-4 py-1.5 font-extrabold">Producto</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Galones</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Precio unitario</th>
                  <th className="px-4 py-1.5 text-right font-extrabold">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.lineas.map((l, i) => (
                  <tr key={l.id} style={{ backgroundColor: i % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                    <td className="px-4 py-1.5 font-semibold text-dark">{l.producto}</td>
                    <td className="px-2 py-1.5 text-right text-dark-2">{money(Number(l.galones))}</td>
                    <td className="px-2 py-1.5 text-right text-dark-2">
                      {money(Number(l.precio_unitario))}
                    </td>
                    <td
                      className="whitespace-nowrap px-4 py-1.5 text-right font-extrabold"
                      style={{ color: col.dark }}
                    >
                      {r.moneda} {money(Number(l.total))}
                    </td>
                  </tr>
                ))}
                {r.lineas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-[11px] italic text-dark-3">
                      Sin productos capturados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 px-8 pb-5">
          {/* Lo que se escaneó del vale o de la factura. */}
          <div className="rounded-lg border px-4 py-3" style={{ borderColor: `${col.solid}55` }}>
            <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: col.dark }}>
              Documento cargado
            </div>
            {r.archivo_path ? (
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="truncate text-[12px] text-dark">
                  📎 {r.archivo_nombre ?? 'Archivo adjunto'}
                </span>
                <button
                  type="button"
                  onClick={onVerArchivo}
                  className="no-print shrink-0 rounded-md border px-2 py-1 text-[11px] font-extrabold hover:opacity-80"
                  style={{ borderColor: `${col.solid}66`, color: col.dark }}
                >
                  👁 Ver
                </button>
              </div>
            ) : (
              <p className="mt-1.5 text-[12px] italic text-dark-3">Sin documento adjunto.</p>
            )}
          </div>

          {/* Y en qué va su solicitud de pago. */}
          <div className="rounded-lg border px-4 py-3" style={{ borderColor: `${col.solid}55` }}>
            <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: col.dark }}>
              Solicitud de pago
            </div>
            {r.pago_id ? (
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="font-mono text-[12px] font-extrabold text-dark">
                  {r.pago_serial ?? 'SP'}
                </span>
                <button
                  type="button"
                  onClick={onVerSolicitud}
                  disabled={cargandoSolicitud}
                  className="no-print shrink-0 rounded-md border px-2 py-1 text-[11px] font-extrabold hover:opacity-80 disabled:opacity-60"
                  style={{ borderColor: `${col.solid}66`, color: col.dark }}
                >
                  {cargandoSolicitud ? 'Abriendo…' : '👁 Ver'}
                </button>
              </div>
            ) : pendiente ? (
              <p className="mt-1.5 text-[12px] text-dark-2">
                Enviada a Pagos. Pendiente de que generen la solicitud.
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] italic text-dark-3">Sin solicitud de pago.</p>
            )}
          </div>
        </section>

        {r.notas && (
          <section className="px-8 pb-5">
            <div
              className="rounded-md border-l-4 px-3 py-2 text-[12px] text-dark"
              style={{ borderLeftColor: col.solid, backgroundColor: col.light }}
            >
              <b style={{ color: col.dark }}>Notas:</b> {r.notas}
            </div>
          </section>
        )}

        <footer
          className="flex items-center justify-between px-8 py-4 text-white"
          style={{ background: col.grad }}
        >
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
              Total facturado
            </div>
            {anulado && (
              <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                No suma al total: registro anulado
              </div>
            )}
          </div>
          <div className="font-heading text-2xl font-extrabold">
            {r.moneda} {money(Number(r.total))}
          </div>
        </footer>

        <div
          className="px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40"
          style={{ backgroundColor: col.dark }}
        >
          CEA · Control de combustible · Documento de uso interno
        </div>
      </article>
    </PrintableModal>
  );
}
