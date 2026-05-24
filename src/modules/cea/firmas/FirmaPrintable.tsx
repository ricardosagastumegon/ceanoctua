import { formatDate, formatDateTime } from '@/lib/dates';
import type { FirmaWithSigners } from './api';

type Props = { firma: FirmaWithSigners; codigos: string[] };

export function FirmaPrintable({ firma, codigos }: Props) {
  return (
    <article className="text-dark">
      <header
        className="rounded-t-md p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a78bfa 100%)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Solicitud de firma
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold">{firma.tipo}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {firma.serial && (
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs">{firma.serial}</span>
          )}
          {firma.urgencia && (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase">
              {firma.urgencia}
            </span>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {firma.status_firma.replace('_', ' ')}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 border-b border-sand bg-sand-l/40 px-6 py-4 text-sm">
        {firma.recepcion && <Field label="Recepción" value={formatDate(firma.recepcion)} />}
        {firma.solicitado && <Field label="Solicitado por" value={firma.solicitado} />}
        {firma.entregado && <Field label="Entregado por" value={firma.entregado} />}
        {codigos.length > 0 && (
          <Field label="Firmantes" value={codigos.join(' · ')} />
        )}
      </section>

      {firma.justificacion && (
        <section className="border-b border-sand px-6 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-dark-3">
            Justificación
          </p>
          <p className="whitespace-pre-line text-sm">{firma.justificacion}</p>
        </section>
      )}

      {(firma.fecha_firma || firma.fecha_entrega || firma.quien_recibe) && (
        <section className="border-b border-sand px-6 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-3">
            Constancia
          </p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {firma.fecha_firma && (
              <Field label="Fecha firma" value={formatDate(firma.fecha_firma)} />
            )}
            {firma.fecha_entrega && (
              <Field label="Fecha entrega" value={formatDate(firma.fecha_entrega)} />
            )}
            {firma.quien_recibe && <Field label="Quien recibe" value={firma.quien_recibe} />}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-8 px-6 py-8">
        <Sig label="Entregado por" name={firma.entregado ?? ''} />
        <Sig label="Recibido por" name={firma.quien_recibe ?? ''} />
      </section>

      <footer className="border-t border-sand bg-sand-l px-6 py-3 text-center text-[10px] text-dark-3">
        Board Assistant · CEA · Firma · {formatDateTime(new Date())}
      </footer>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
function Sig({ label, name = '' }: { label: string; name?: string }) {
  return (
    <div className="text-center">
      <div className="mb-2 h-16 border-b-2 border-dark/40" />
      <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">{label}</p>
      {name && <p className="mt-1 text-sm">{name}</p>}
    </div>
  );
}
