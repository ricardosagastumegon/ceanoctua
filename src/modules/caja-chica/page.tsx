import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { usePeriodos, useCreatePeriodo, useDeletePeriodo } from './hooks';
import type { Periodo } from './types';
import { PeriodoDetail, NuevoPeriodoModal } from './PeriodoDetail';

export default function CajaChicaPage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';

  const query = usePeriodos();
  const create = useCreatePeriodo();
  const remove = useDeletePeriodo();
  const toast = useToast();

  const [selected, setSelected] = useState<Periodo | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);

  // Si hay un período seleccionado, mostrar detalle.
  if (selected) {
    return <PeriodoDetail periodo={selected} onBack={() => setSelected(null)} />;
  }

  const periodos = query.data ?? [];

  async function handleCreate(values: { titulo: string; fecha: string; monto_inicial: number; notas: string }) {
    try {
      const row = await create.mutateAsync({
        titulo: values.titulo || null,
        fecha: values.fecha,
        monto_inicial: values.monto_inicial,
        notas: values.notas || null,
      });
      toast.success('Período creado: ' + (row.serial ?? row.id));
      setNuevoOpen(false);
      setSelected(row);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(p: Periodo) {
    if (!window.confirm(`¿Eliminar período ${p.serial ?? p.id}? Esta acción es reversible (soft delete).`)) return;
    try {
      await remove.mutateAsync(p.id);
      toast.success('Período eliminado.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-dark">Caja Chica</h1>
          <p className="mt-1 text-sm text-dark-2">
            Períodos con correlativo <span className="font-mono">CCO-AAAA-NNNN</span>. Cada período tiene su monto inicial y sus líneas de gasto.
            {!canEdit && ' Solo lectura.'}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setNuevoOpen(true)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-d"
          >
            + Nuevo período
          </button>
        )}
      </header>

      {query.isLoading && <div className="text-sm text-dark-3">Cargando períodos…</div>}
      {query.isError && (
        <div className="rounded-md border border-rust/40 bg-rust-l p-4 text-sm text-rust">
          Error al cargar: {(query.error as Error).message}
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="ml-2 rounded border border-rust px-2 py-0.5 text-xs font-semibold"
          >
            Reintentar
          </button>
          <div className="mt-2 text-xs text-dark-3">
            Si el error dice <em>column not found in schema cache</em> o <em>relation does not exist</em>,
            la migración Fase 20 aún no está aplicada en Supabase. Aplica{' '}
            <code className="rounded bg-white px-1">supabase/migrations/20260809000001_fase20_caja_chica_op.sql</code>{' '}
            en Supabase Studio y refresca.
          </div>
        </div>
      )}

      {!query.isLoading && !query.isError && periodos.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-sand-d bg-white p-8 text-center">
          <p className="text-sm italic text-dark-3">Sin períodos todavía.</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setNuevoOpen(true)}
              className="mt-3 rounded-md bg-teal px-4 py-2 text-sm font-bold text-white hover:bg-teal-d"
            >
              + Crear primer período
            </button>
          )}
        </div>
      )}

      {periodos.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {periodos.map((p) => (
            <article
              key={p.id}
              className="group cursor-pointer rounded-lg border border-sand bg-white p-4 shadow-sm transition-all hover:border-teal hover:shadow-md"
              onClick={() => setSelected(p)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-bold text-teal-d">{p.serial ?? '—'}</div>
                  <div className="mt-0.5 truncate font-semibold text-dark">{p.titulo ?? '(sin título)'}</div>
                  <div className="mt-1 text-xs text-dark-3">{formatDate(p.fecha)}</div>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    p.estado === 'Abierto' ? 'bg-teal-l text-teal-d' : 'bg-sand text-dark-3'
                  }`}
                >
                  {p.estado}
                </span>
              </div>
              <div className="mt-3 border-t border-sand pt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-dark-3">Monto inicial</div>
                <div className="font-mono text-lg font-bold text-dark">{formatMoney(Number(p.monto_inicial))}</div>
              </div>
              {canEdit && (
                <div className="mt-3 flex justify-end border-t border-sand pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(p);
                    }}
                    className="rounded border border-rust/40 px-2 py-0.5 text-[10px] font-semibold text-rust hover:bg-rust-l"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <NuevoPeriodoModal
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onCreate={handleCreate}
        submitting={create.isPending}
      />
    </section>
  );
}
