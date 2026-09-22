import { type ReactNode } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { SERVICE_META, type ServiceKey } from './constants/serviceMeta';
import { fmtMoney } from './utils';
import logoBlanco from './arriaza-logo-blanco.png';

type Props = {
  open: boolean;
  onClose: () => void;
  serviceKey: ServiceKey;
  title: string;
  subtitle?: string | null;
  /** Correlativo del viaje, para que la hoja se pueda rastrear. */
  tripNo?: string | null;
  total?: number | null;
  moneda?: string | null;
  estadoPago?: string | null;
  pagadoCon?: string | null;
  confirmacion?: string | null;
  cancelacion?: string | null;
  /** Filas del cuerpo, cada una label + valor. */
  rows: Array<{ label: string; value: ReactNode }>;
  /** Bloques extra al final (pasajeros, habitaciones, tickets de actividad…). */
  extras?: ReactNode;
  /**
   * Franja sobre el encabezado. El hotel la usa para el rango de fechas, que
   * es lo primero que se busca en la hoja de una reserva.
   */
  band?: ReactNode;
  /**
   * Dato corto bajo el logo, alineado a la derecha. El ticket lo usa para la
   * fecha de salida y el PNR: es lo que se busca con la hoja en la mano.
   */
  headerRight?: ReactNode;
  /** Título a mayor tamaño cuando es el dato principal de la hoja. */
  titleSize?: 'normal' | 'grande';
};

/**
 * Vista previa imprimible, compartida por los 11 servicios.
 *
 * Cada servicio entra con su propio color — el de `SERVICE_META` — así que la
 * hoja de un hotel y la de un vuelo se distinguen de un vistazo sin cambiar de
 * plantilla.
 *
 * El logo va como imagen importada: antes esto se armaba con `innerHTML` y un
 * helper que devolvía un placeholder de texto porque el logo real nunca se
 * había incorporado.
 */
export function ServicePrintable({
  open, onClose, serviceKey, title, subtitle, tripNo, total, moneda,
  estadoPago, pagadoCon, confirmacion, cancelacion, rows, extras, band,
  headerRight, titleSize = 'normal',
}: Props) {
  const meta = SERVICE_META[serviceKey];
  return (
    <PrintableModal open={open} onClose={onClose} title={`${meta.icon} ${meta.label} — ${title}`}>
      <article style={{ fontFamily: 'Nunito, sans-serif', color: '#321201' }}>
        {band && (
          <div
            className="px-8 py-2 font-heading text-lg font-extrabold text-white"
            style={{ background: meta.dark }}
          >
            {band}
          </div>
        )}
        {/* Encabezado con el color del servicio */}
        <header
          className="relative px-8 py-6 text-white"
          style={{ background: meta.grad ?? meta.dark }}
        >
          <div style={{ position: 'absolute', top: '1.4rem', right: '1.75rem', textAlign: 'right' }}>
            <img src={logoBlanco} alt="Arriaza Tour &amp; Travel" style={{ height: '26px' }} />
            {headerRight && (
              <div
                style={{
                  marginTop: '.5rem', fontSize: '.8rem', fontWeight: 800,
                  letterSpacing: '.04em', color: '#ffffff',
                }}
              >
                {headerRight}
              </div>
            )}
          </div>
          <div
            style={{
              fontSize: '.6rem', fontWeight: 800, letterSpacing: '.2em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,.55)',
            }}
          >
            Servicio · {meta.label}
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: titleSize === 'grande' ? '2.4rem' : '1.6rem',
              fontWeight: 800, lineHeight: 1.1, marginTop: '.3rem',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ marginTop: '.4rem', fontSize: '.85rem', fontWeight: 600, color: 'rgba(255,255,255,.75)' }}>
              {subtitle}
            </div>
          )}
          {tripNo && (
            <div
              style={{
                marginTop: '.6rem', display: 'inline-block', borderRadius: '999px',
                background: 'rgba(255,255,255,.18)', padding: '.15rem .6rem',
                fontFamily: 'monospace', fontSize: '.7rem', fontWeight: 800,
              }}
            >
              {tripNo}
            </div>
          )}
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2 px-8 py-6">
          {rows.map(({ label, value }, i) => (
            <div key={i} className="border-b border-sand py-1">
              <div
                className="text-[10px] font-extrabold uppercase tracking-wider"
                style={{ color: meta.dark }}
              >
                {label}
              </div>
              <div className="mt-0.5 text-sm text-dark-2">{value ?? '—'}</div>
            </div>
          ))}
        </section>

        {extras && <section className="px-8 pb-6">{extras}</section>}

        {(total != null || estadoPago) && (
          <footer
            className="flex items-center justify-between px-8 py-4 text-white"
            style={{ background: meta.grad ?? meta.dark }}
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                {meta.icon} Total del servicio
              </div>
              {pagadoCon && <div className="mt-0.5 text-[10px] text-white/60">Pagado con: {pagadoCon}</div>}
              {estadoPago && (
                <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                  Estado: {estadoPago}
                </div>
              )}
            </div>
            {total != null && (
              <div className="font-heading text-2xl font-extrabold text-white">
                {moneda ? `${moneda} ${total.toFixed(2)}` : fmtMoney(total)}
              </div>
            )}
          </footer>
        )}

        {(confirmacion || cancelacion) && (
          <section className="border-t border-sand px-8 py-4 text-xs text-dark-3">
            {confirmacion && <div><b>Confirmación:</b> {confirmacion}</div>}
            {cancelacion && <div><b>Cancelación:</b> {cancelacion}</div>}
          </section>
        )}

        <div className="bg-dark px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40">
          Arriaza Tour &amp; Travel · Documento de uso interno
        </div>
      </article>
    </PrintableModal>
  );
}
