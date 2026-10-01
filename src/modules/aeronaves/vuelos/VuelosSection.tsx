import { useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { acento } from '../constants';
import type { Aeronave } from '../api';
import { PilotosPanel } from './PilotosPanel';
import { VueloFormModal } from './VueloFormModal';
import { VueloPrintable } from './VueloPrintable';
import { useBorrarVuelo, useVuelos } from './hooks';
import { rotuloMando, type VueloCompleto } from './api';

const h1 = (n: number) => n.toFixed(1);

/**
 * La bitácora de vuelo de la aeronave.
 *
 * Es el origen de todo lo demás del módulo: de acá salen las horas, y de las
 * horas saldrán después los cobros por uso personal y la cuenta regresiva de
 * los mantenimientos.
 */
export function VuelosSection({
  aeronave,
  canEdit,
  canBorrar,
}: {
  aeronave: Aeronave;
  canEdit: boolean;
  canBorrar: boolean;
}) {
  const col = acento(aeronave.acento);
  const q = useVuelos(aeronave.id);
  const borrar = useBorrarVuelo(aeronave.id);
  const toast = useToast();
  const confirmar = useConfirm();

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<VueloCompleto | null>(null);
  const [viendo, setViendo] = useState<VueloCompleto | null>(null);

  const vuelos = useMemo(() => q.data ?? [], [q.data]);

  const kpis = useMemo(() => {
    const hoy = new Date();
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const anio = String(hoy.getFullYear());
    // El horómetro de la aeronave es el más alto que reportó cualquier tramo:
    // es un contador, no se reinicia.
    let horometro = 0;
    for (const v of vuelos) {
      for (const t of v.tramos) {
        if (t.horometro_llegada != null) horometro = Math.max(horometro, Number(t.horometro_llegada));
      }
    }
    return {
      mes: vuelos.filter((v) => v.fecha.startsWith(mes)).reduce((s, v) => s + Number(v.horas), 0),
      anio: vuelos.filter((v) => v.fecha.startsWith(anio)).reduce((s, v) => s + Number(v.horas), 0),
      total: vuelos.reduce((s, v) => s + Number(v.horas), 0),
      horometro,
    };
  }, [vuelos]);

  async function quitar(v: VueloCompleto) {
    const ok = await confirmar({
      title: 'Borrar vuelo',
      message: (
        <>
          ¿Borrar el vuelo <b>{v.serial ?? ''}</b> del {formatDate(v.fecha)}, con sus{' '}
          {v.tramos.length} tramo{v.tramos.length === 1 ? '' : 's'}?
        </>
      ),
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(v.id);
      toast.success('Vuelo borrado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="space-y-4">
      {/* Las horas, que es a lo que viene esta pestaña. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { r: 'Horas del mes', v: h1(kpis.mes) },
          { r: 'Horas del año', v: h1(kpis.anio) },
          { r: 'Horas registradas', v: h1(kpis.total) },
          { r: 'Horómetro', v: kpis.horometro ? h1(kpis.horometro) : '—' },
        ].map((k) => (
          <div key={k.r} className="rounded-card border border-sand bg-white px-4 py-3 shadow-sm">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">{k.r}</div>
            <div className="mt-0.5 font-heading text-xl font-extrabold" style={{ color: col.dark }}>
              {k.v}
            </div>
          </div>
        ))}
      </div>

      <PilotosPanel aeronave={aeronave} canEdit={canEdit} />

      <div className="rounded-card border border-sand bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: col.dark }}>
              Bitácora de vuelo · {aeronave.matricula}
            </h2>
            <p className="mt-0.5 text-[11px] text-dark-3">
              Lo que reporta el piloto. Las horas salen del horómetro, no del reloj.
            </p>
          </div>
          {canEdit && (
            <button type="button" onClick={() => { setEditando(null); setAbierto(true); }}
              className="rounded-md px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"
              style={{ backgroundColor: col.solid }}>
              ＋ Nuevo vuelo
            </button>
          )}
        </div>

        {q.isLoading && <p className="text-sm text-dark-3">Cargando vuelos…</p>}
        {q.isError && (
          <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
            {describeError(q.error)}
          </div>
        )}
        {q.data && vuelos.length === 0 && (
          <p className="py-4 text-sm italic text-dark-3">Todavía no hay vuelos registrados.</p>
        )}

        {vuelos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left" style={{ backgroundColor: col.light, color: col.dark }}>
                  <th className="whitespace-nowrap px-2 py-2 font-extrabold">No.</th>
                  <th className="whitespace-nowrap px-2 py-2 font-extrabold">Fecha</th>
                  <th className="px-2 py-2 font-extrabold">Ruta</th>
                  <th className="px-2 py-2 font-extrabold">Al mando</th>
                  <th className="px-2 py-2 font-extrabold">Propósito</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-extrabold">Pax</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-extrabold">Horas</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {vuelos.map((v) => (
                  <tr key={v.id} className="border-b border-sand">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] font-extrabold text-dark">
                      {v.serial ?? '—'}
                      {v.numero && <div className="text-[10px] font-normal text-dark-3">{v.numero}</div>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-dark-2">{formatDate(v.fecha)}</td>
                    {/* La ruta encadenada: MGGT → MGRT → MGQZ → MGGT */}
                    <td className="px-2 py-2 font-mono text-[11px] text-dark">
                      {v.tramos.length
                        ? [v.tramos[0].origen, ...v.tramos.map((t) => t.destino)]
                            .map((x) => x || '?').join(' → ')
                        : '—'}
                      <div className="font-sans text-[10px] text-dark-3">
                        {v.tramos.length} tramo{v.tramos.length === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-dark-2">
                      {rotuloMando(v.mando)}
                      {(v.piloto || v.instructor) && (
                        <div className="text-[10px] text-dark-3">{v.piloto ?? v.instructor}</div>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-2 py-2 text-dark-3">{v.proposito ?? '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-dark-2">
                      {v.pasajeros.length || '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-extrabold"
                      style={{ color: col.dark }}>
                      {h1(Number(v.horas))}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button type="button" title="Ver e imprimir la bitácora"
                        onClick={() => setViendo(v)}
                        className="px-1 text-[12px] opacity-50 hover:opacity-100">👁</button>
                      {canEdit && (
                        <button type="button" title="Editar"
                          onClick={() => { setEditando(v); setAbierto(true); }}
                          className="px-1 text-[12px] opacity-50 hover:opacity-100">✏️</button>
                      )}
                      {canBorrar && (
                        <button type="button" title="Borrar" onClick={() => void quitar(v)}
                          className="px-1 text-[12px] opacity-50 hover:opacity-100">🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-2 py-2 text-right text-[11px] font-extrabold uppercase tracking-wider text-dark-2">
                    Total registrado
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-heading text-sm font-extrabold"
                    style={{ color: col.dark }}>
                    {h1(kpis.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {viendo && (
        <VueloPrintable aeronave={aeronave} vuelo={viendo} onClose={() => setViendo(null)} />
      )}

      {abierto && (
        <VueloFormModal
          aeronave={aeronave}
          editando={editando}
          onClose={() => { setAbierto(false); setEditando(null); }}
        />
      )}
    </div>
  );
}
