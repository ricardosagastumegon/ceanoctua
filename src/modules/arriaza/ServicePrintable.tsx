import { type ReactNode } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { SERVICE_META, type ServiceKey, type EstadoPago } from './constants/serviceMeta';
import { fmtMoney } from './utils';
import { logoCornerHTML } from './branding';

type Props = {
  open: boolean;
  onClose: () => void;
  serviceKey: ServiceKey;
  title: string;
  subtitle?: string | null;
  total?: number | null;
  estadoPago?: EstadoPago | null;
  pagadoCon?: string | null;
  confirmacion?: string | null;
  cancelacion?: string | null;
  /** Rows del cuerpo · cada uno con label + value.  */
  rows: Array<{ label: string; value: ReactNode }>;
  /** Bloques extra al final (habitaciones, tickets de actividad, etc.) */
  extras?: ReactNode;
};

// Template genérico para todos los printables de servicios T&T.
// Header con gradient del serviceMeta + logo Arriaza + subtitle.
// Cuerpo con grid de rows label|value.
// Footer con total + estado_pago + pagado_con + cancelacion.
export function ServicePrintable({
  open, onClose, serviceKey, title, subtitle, total, estadoPago, pagadoCon,
  confirmacion, cancelacion, rows, extras,
}: Props) {
  const meta = SERVICE_META[serviceKey];
  return (
    <PrintableModal open={open} onClose={onClose} title={`${meta.icon} ${meta.label} — ${title}`}>
      <article style={{ fontFamily: 'Nunito, sans-serif' }} className="overflow-hidden">
        {/* Header con gradient + logo */}
        <header
          style={{ background: meta.grad }}
          className="relative px-8 py-6 text-white"
          dangerouslySetInnerHTML={{
            __html: `
              ${logoCornerHTML('white')}
              <div style="font-size:.6rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:.3rem;">
                Servicio · ${meta.label}
              </div>
              <div style="font-family:Montserrat,sans-serif;font-size:1.6rem;font-weight:800;line-height:1.15;">${escapeHtml(title)}</div>
              ${subtitle ? `<div style="margin-top:.4rem;font-size:.85rem;color:rgba(255,255,255,.75);font-weight:600;">${escapeHtml(subtitle)}</div>` : ''}
            `,
          }}
        />

        {/* Rows del cuerpo */}
        <section className="grid grid-cols-2 gap-x-6 gap-y-2 px-8 py-6">
          {rows.map(({ label, value }, i) => (
            <div key={i} className="border-b border-sand py-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
                {label}
              </div>
              <div className="mt-0.5 text-sm text-dark-2">{value ?? '—'}</div>
            </div>
          ))}
        </section>

        {extras && <section className="px-8 pb-6">{extras}</section>}

        {/* Footer con total + estado */}
        {(total != null || estadoPago) && (
          <footer style={{ background: meta.grad }} className="mt-4 flex items-center justify-between px-8 py-4 text-white">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                {meta.icon} Total del servicio
              </div>
              {pagadoCon && <div className="mt-0.5 text-[10px] text-white/60">Pagado con: {pagadoCon}</div>}
              {estadoPago && <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/70">Estado: {estadoPago}</div>}
            </div>
            {total != null && (
              <div className="font-heading text-2xl font-extrabold text-white">{fmtMoney(total)}</div>
            )}
          </footer>
        )}

        {(confirmacion || cancelacion) && (
          <section className="border-t border-sand px-8 py-4 text-xs text-dark-3">
            {confirmacion && (
              <div><b>ConfirmaciÓn:</b> {confirmacion}</div>
            )}
            {cancelacion && (
              <div><b>Cancelación:</b> {cancelacion}</div>
            )}
          </section>
        )}

        <div className="bg-dark px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40">
          CEA · Arriaza Tour &amp; Travel · Documento de uso interno
        </div>
      </article>
    </PrintableModal>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
