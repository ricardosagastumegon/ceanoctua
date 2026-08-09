import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { findCountry } from './constants/countries';
import { fmtDate, slug, fmtMoney } from './utils';
import { MANUAL_STATUS_COLORS, type ManualStatus } from './constants/serviceMeta';
import type { AttViaje } from './viajes/api';

type Props = { open: boolean; onClose: () => void; viaje: AttViaje | null };

// Modal Share · genera imagen PNG del resumen del viaje para pegar en
// WhatsApp / Slack / email. Usa html2canvas lazy-loaded (~35KB gzip).
// Paridad con ttOpenShareModal + ttBuildShareCardHTML del standalone.
export function ShareModal({ open, onClose, viaje }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  async function download() {
    if (!cardRef.current || !viaje) return;
    setBusy(true);
    try {
      // Lazy load html2canvas para no engordar el bundle inicial.
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `viaje_${slug(viaje.titulo)}.png`;
      a.click();
      toast.success('Imagen descargada. Pégala en WhatsApp / Slack.');
    } catch (e) {
      toast.error(`No se pudo generar la imagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!viaje) return null;

  const flag = findCountry(viaje.pais)?.flag ?? '📍';
  const status = (viaje.manual_status ?? 'Solicitado') as ManualStatus;
  const c = MANUAL_STATUS_COLORS[status];

  return (
    <Modal open={open} onClose={onClose} title="📲 Compartir viaje" size="md">
      <div className="space-y-4">
        <p className="text-xs text-dark-2">
          Descarga una imagen del resumen para pegarla en WhatsApp / Slack / email.
        </p>

        {/* Tarjeta visible que se convierte a PNG. */}
        <div
          ref={cardRef}
          className="mx-auto max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-lg"
          style={{ fontFamily: 'Nunito, sans-serif' }}
        >
          <div className="bg-gradient-to-br from-navy via-teal-d to-aqua p-4 text-white">
            <div className="text-[9px] font-extrabold uppercase tracking-widest text-white/60">
              CEA · Board Assistant
            </div>
            <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
              {viaje.trip_no ?? 'Viaje'}
            </div>
            <div
              className="mt-1 font-heading text-lg font-extrabold text-white"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              {flag} {viaje.titulo}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-white/80">
              📍 {viaje.destino ?? '—'}{viaje.pais ? ` · ${viaje.pais}` : ''}
            </div>
            <div className="mt-0.5 text-[11px] text-white/70">
              📅 {fmtDate(viaje.fecha_ini)} — {fmtDate(viaje.fecha_fin)}
            </div>
          </div>

          <div className="space-y-2 p-4">
            {viaje.acompanantes && (
              <div className="text-xs">
                <span className="font-extrabold text-dark-2">👥 Participantes:</span>{' '}
                <span className="text-dark-2">{viaje.acompanantes}</span>
              </div>
            )}
            {viaje.proposito && (
              <div className="text-xs">
                <span className="font-extrabold text-dark-2">🎯 Motivo:</span>{' '}
                <span className="text-dark-2">{viaje.proposito}</span>
              </div>
            )}
            <div>
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                {status}
              </span>
            </div>
            <div className="mt-2 rounded-lg bg-gradient-to-br from-navy to-teal-d p-3 text-center text-white">
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-white/60">
                💰 Costo total
              </div>
              <div className="font-heading text-lg font-extrabold text-white">
                {fmtMoney(0)}
              </div>
              <div className="text-[9px] text-white/50">
                (suma en tiempo real desde el dashboard)
              </div>
            </div>
          </div>

          <div className="bg-navy px-4 py-2 text-center text-[9px] font-extrabold uppercase tracking-widest text-white/40">
            Arriaza · Tour &amp; Travel
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => void download()}
            disabled={busy}
            className="rounded-md bg-teal px-4 py-2 text-sm font-extrabold text-white hover:bg-teal-d disabled:opacity-50"
          >
            {busy ? '📸 Generando…' : '⬇ Descargar imagen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
