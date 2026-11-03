import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useFirmas } from '@/modules/cea/firmas/hooks';
import { usePagos } from '@/modules/finanzas/pagos/hooks';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { RANGO_PERMISO } from '@/types';

/** Lo urgente primero; dentro de cada urgencia, lo que lleva más tiempo esperando. */
const PESO_URGENCIA: Record<string, number> = { urgente: 0, importante: 1, programado: 2 };

const TONO_URGENCIA: Record<string, string> = {
  urgente: 'bg-rust text-white',
  importante: 'bg-gold-light text-gold',
  programado: 'bg-sand text-dark-2',
};

function fmt(n: number, moneda: string | null): string {
  if (!moneda || moneda === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: moneda }).format(Number(n));
}

/** Días calendario que lleva esperando. */
function diasEsperando(recepcion: string | null): number | null {
  if (!recepcion) return null;
  const d = new Date(recepcion);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

/**
 * Lo que espera la firma de quien está entrando.
 *
 * Va arriba de todo y no como una tarjeta más del tablero: para quien firma,
 * esto no es un indicador, es su trabajo. Antes había que saber que vivía en
 * CEA → Firmas y entrar a buscarlo.
 *
 * Solo aparece si esa persona puede firmar de verdad --`puede('cea','editor')`
 * del lado de la base-- y si hay algo esperando. A quien no firma no le
 * estorba.
 */
export function FirmasPendientes() {
  const { profile } = useAuth();
  const firmasQ = useFirmas();
  const pagosQ = usePagos();

  const puedeFirmar =
    profile?.rol === 'admin' ||
    RANGO_PERMISO[profile?.modulos?.cea ?? 'observador'] >= RANGO_PERMISO.editor;

  const pendientes = (firmasQ.data ?? [])
    .filter((f) => f.status_firma === 'en_espera')
    .sort(
      (a, b) =>
        (PESO_URGENCIA[a.urgencia ?? 'programado'] ?? 2) -
          (PESO_URGENCIA[b.urgencia ?? 'programado'] ?? 2) ||
        (a.recepcion ?? '').localeCompare(b.recepcion ?? ''),
    );

  if (!puedeFirmar || pendientes.length === 0) return null;

  // El contexto de lo que se firma: una solicitud de pago dice a quién y
  // cuánto. Sin eso, "Pago SP-2026-0011" no alcanza para decidir.
  const porPago = new Map((pagosQ.data ?? []).map((p) => [p.id, p]));

  return (
    <section className="rounded-card border-2 border-gold bg-gold-light/40 p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-extrabold text-dark">
            ✍️ {pendientes.length} {pendientes.length === 1 ? 'documento espera' : 'documentos esperan'} tu firma
          </h2>
          <p className="text-[11px] text-dark-2">
            Lo más urgente y lo que lleva más tiempo esperando, primero.
          </p>
        </div>
        <Link
          to="/cea"
          className="rounded-md bg-gold px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-90"
        >
          Ir a firmar →
        </Link>
      </header>

      <ul className="space-y-1.5">
        {pendientes.slice(0, 8).map((f) => {
          const pago = f.pago_id ? porPago.get(f.pago_id) : undefined;
          const dias = diasEsperando(f.recepcion);
          return (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-sand bg-white px-3 py-2"
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                  TONO_URGENCIA[f.urgencia ?? 'programado'] ?? TONO_URGENCIA.programado
                }`}
              >
                {f.urgencia ?? 'programado'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-dark">{f.tipo}</span>
                <span className="block truncate text-[11px] text-dark-3">
                  {[pago?.proveedor ?? f.solicitado, f.justificacion].filter(Boolean).join(' · ')}
                </span>
              </span>
              {pago && (
                <span className="shrink-0 font-mono text-sm font-extrabold text-dark">
                  {fmt(Number(pago.monto), pago.moneda)}
                </span>
              )}
              <span className="shrink-0 text-right text-[10px] text-dark-3">
                {f.recepcion ? formatDate(f.recepcion) : '—'}
                {dias != null && dias > 2 && (
                  <span className="block font-extrabold text-rust">
                    {dias} día{dias === 1 ? '' : 's'} esperando
                  </span>
                )}
              </span>
            </li>
          );
        })}
        {pendientes.length > 8 && (
          <li className="px-3 text-[11px] text-dark-3">
            y {pendientes.length - 8} más en CEA → Firmas
          </li>
        )}
      </ul>
    </section>
  );
}
