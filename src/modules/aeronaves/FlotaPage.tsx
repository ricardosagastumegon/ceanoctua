import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, puede } from '@/lib/auth';
import { describeError } from '@/modules/admin/hooks';
import { useAeronaves } from './hooks';
import { AeronaveFormModal } from './AeronaveFormModal';
import { FotoAeronave } from './FotoAeronave';
import { acento, ESTADO_COLOR } from './constants';
import type { Aeronave } from './api';

/**
 * La flota · capa 2 del módulo.
 *
 * Un botón grande por aeronave. De aquí en adelante todo lo que se ve
 * pertenece a una sola: la información queda independiente, pero vive en el
 * mismo lugar.
 */
export function FlotaPage() {
  const { profile } = useAuth();
  const canEdit = puede(profile, 'aeronaves', 'editor');
  const q = useAeronaves();
  const [editando, setEditando] = useState<Aeronave | null | undefined>(undefined);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-dark">Aeronaves</h1>
          <p className="mt-0.5 text-sm text-dark-2">
            Escoge una aeronave para ver su ficha, sus certificados y su operación.
          </p>
        </div>
      </header>

      {q.isLoading && <p className="text-sm text-dark-3">Cargando la flota…</p>}

      {q.isError && (
        <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
          {describeError(q.error)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((a) => (
          <BotonAeronave key={a.id} aeronave={a} />
        ))}

        {canEdit && (
          <button
            type="button"
            onClick={() => setEditando(null)}
            className="flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-sand-d bg-white text-dark-3 transition-colors hover:border-teal hover:text-teal"
          >
            <span className="text-3xl leading-none">＋</span>
            <span className="font-heading text-sm font-extrabold">Registrar aeronave</span>
          </button>
        )}
      </div>

      {!q.isLoading && (q.data ?? []).length === 0 && !canEdit && (
        <p className="text-sm italic text-dark-3">Todavía no hay aeronaves registradas.</p>
      )}

      <AeronaveFormModal
        open={editando !== undefined}
        editando={editando ?? null}
        onClose={() => setEditando(undefined)}
      />
    </section>
  );
}

function BotonAeronave({ aeronave: a }: { aeronave: Aeronave }) {
  const col = acento(a.acento);

  return (
    <Link
      to={`/aeronaves/${encodeURIComponent(a.matricula)}`}
      className="group relative flex min-h-[210px] flex-col justify-between overflow-hidden rounded-card text-white shadow-sm transition-shadow hover:shadow-lg"
      style={{ background: col.grad }}
    >
      {/* La foto, muy tenue, detrás. Da carácter sin estorbar la lectura. */}
      <FotoAeronave
        path={a.foto_path}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 transition-opacity group-hover:opacity-35"
      />

      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '-50px',
          top: '-70px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,.08)',
        }}
      />

      <div className="relative p-5">
        <div className="font-heading text-3xl font-extrabold leading-none tracking-tight">
          {a.matricula}
        </div>
        <div className="mt-1.5 text-[13px] font-semibold text-white/85">{a.nombre ?? '—'}</div>
        <div className="mt-0.5 text-[11px] text-white/60">
          {[a.tipo_aeronave, a.modelo].filter(Boolean).join(' · ')}
        </div>
      </div>

      <div className="relative flex items-center justify-between gap-2 px-5 pb-5">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
            ESTADO_COLOR[a.estado] ?? 'bg-white/20 text-white'
          }`}
        >
          {a.estado}
        </span>
        <span className="text-[11px] font-extrabold text-white/70 transition-transform group-hover:translate-x-0.5">
          Abrir →
        </span>
      </div>
    </Link>
  );
}
