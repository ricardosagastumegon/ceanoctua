import { useMemo, useState } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { NotaEntregaForm } from './NotaEntregaForm';
import { NotaEntregaPrintable } from './NotaEntregaPrintable';
import { useBorrarNotaEntrega, useNotasEntrega } from './hooks';
import type { NotaEntrega } from './api';

/**
 * El listado de notas de entrega de documentos.
 *
 * Es la razón de ser del módulo: hoy la nota se hace en un Word suelto, sin
 * correlativo y sin forma de encontrar la de hace tres meses. Acá cada una
 * tiene su `NED-AAAA-####` y se puede buscar, ver e imprimir.
 */
export function NotasEntregaSection({ canEdit }: { canEdit: boolean }) {
  const q = useNotasEntrega();
  const borrar = useBorrarNotaEntrega();
  const toast = useToast();
  const confirmar = useConfirm();

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<NotaEntrega | null>(null);
  const [viendo, setViendo] = useState<NotaEntrega | null>(null);
  const [busca, setBusca] = useState('');

  const filas = useMemo(() => {
    const todas = q.data ?? [];
    const t = busca.trim().toLowerCase();
    if (!t) return todas;
    return todas.filter((n) =>
      [n.serial, n.para, n.departamento, n.descripcion, n.entregado_por, n.solicitado_por]
        .some((v) => (v ?? '').toLowerCase().includes(t)),
    );
  }, [q.data, busca]);

  async function quitar(n: NotaEntrega) {
    const ok = await confirmar({
      title: 'Borrar nota de entrega',
      message: (
        <>
          ¿Borrar la nota <b>{n.serial ?? ''}</b> dirigida a <b>{n.para}</b>?
        </>
      ),
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(n.id);
      toast.success('Nota borrada.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-sand bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
              Notas de entrega de documentos
            </h2>
            <p className="mt-0.5 text-[11px] text-dark-3">
              La constancia de qué se entregó, a quién y cuándo. Cada una con su correlativo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por correlativo, nombre o documento…"
              className="w-64 rounded-md border border-sand px-3 py-2 text-xs text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => { setEditando(null); setAbierto(true); }}
                className="rounded-md bg-teal px-3 py-2 text-xs font-extrabold text-white hover:bg-teal-d"
              >
                ＋ Nueva nota
              </button>
            )}
          </div>
        </div>

        {q.isLoading && <p className="text-sm text-dark-3">Cargando notas…</p>}
        {q.isError && (
          <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
            {describeError(q.error)}
          </div>
        )}
        {q.data && filas.length === 0 && (
          <p className="py-4 text-sm italic text-dark-3">
            {busca ? 'Ninguna nota coincide con la búsqueda.' : 'Todavía no hay notas de entrega.'}
          </p>
        )}

        {filas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-teal-l text-left text-teal-d">
                  <th className="whitespace-nowrap px-2 py-2 font-extrabold">No.</th>
                  <th className="whitespace-nowrap px-2 py-2 font-extrabold">Fecha</th>
                  <th className="px-2 py-2 font-extrabold">Para</th>
                  <th className="px-2 py-2 font-extrabold">Departamento</th>
                  <th className="px-2 py-2 font-extrabold">Documentos</th>
                  <th className="px-2 py-2 font-extrabold">Entregado por</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {filas.map((n) => (
                  <tr key={n.id} className="border-b border-sand">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] font-extrabold text-dark">
                      {n.serial ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-dark-2">{formatDate(n.fecha)}</td>
                    <td className="px-2 py-2 font-semibold text-dark">{n.para}</td>
                    <td className="px-2 py-2 text-dark-2">{n.departamento ?? '—'}</td>
                    {/* Una línea del detalle alcanza para reconocerla; el
                        resto está en la hoja. */}
                    <td className="max-w-xs truncate px-2 py-2 text-dark-3">
                      {(n.descripcion ?? '').split('\n')[0] || '—'}
                    </td>
                    <td className="px-2 py-2 text-dark-2">{n.entregado_por ?? '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button type="button" onClick={() => setViendo(n)}
                        title="Ver e imprimir"
                        className="px-1 text-[12px] opacity-50 hover:opacity-100">👁</button>
                      {canEdit && (
                        <>
                          <button type="button"
                            onClick={() => { setEditando(n); setAbierto(true); }}
                            title="Editar"
                            className="px-1 text-[12px] opacity-50 hover:opacity-100">✏️</button>
                          <button type="button" onClick={() => void quitar(n)}
                            title="Borrar"
                            className="px-1 text-[12px] opacity-50 hover:opacity-100">🗑</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abierto && (
        <NotaEntregaForm
          editando={editando}
          onClose={() => { setAbierto(false); setEditando(null); }}
        />
      )}

      {viendo && (
        <PrintableModal
          open
          onClose={() => setViendo(null)}
          title={`Nota de entrega ${viendo.serial ?? ''}`}
        >
          <NotaEntregaPrintable nota={viendo} />
        </PrintableModal>
      )}
    </div>
  );
}
