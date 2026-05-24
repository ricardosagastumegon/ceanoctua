import { useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { StepTracker } from '@/components/ui/StepTracker';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { KPI } from '@/modules/dashboard/widgets';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  useAdvancePago,
  useCreatePago,
  useDeletePago,
  usePagos,
  useUpdatePago,
  useUploadPagoComprobante,
} from './hooks';
import { PAGO_STEPS, PAGO_TIPO_COLORS, type Pago, type PagoInsert } from './api';
import { PagoForm } from './PagoForm';
import { PagoPrintable } from './PagoPrintable';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

const estadoBg: Record<Pago['estado'], string> = {
  Programado: 'bg-sand text-dark',
  Aprobado: 'bg-blue-light text-blue',
  Pagado: 'bg-teal-l text-teal-d',
  Conciliado: 'bg-teal text-white',
  Anulado: 'bg-rust-l text-rust',
  Devuelto: 'bg-rust text-white',
};

export function PagosSection({ canEdit }: { canEdit: boolean }) {
  const query = usePagos();
  const create = useCreatePago();
  const update = useUpdatePago();
  const advance = useAdvancePago();
  const upload = useUploadPagoComprobante();
  const remove = useDeletePago();
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<Pago | null | undefined>(undefined);
  const [viewing, setViewing] = useState<Pago | null>(null);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterStep, setFilterStep] = useState<string>('');
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const all = query.data ?? [];

  const filtered = useMemo(() => {
    return all.filter((p) => {
      if (filterTipo && (p.tipo_label ?? '') !== filterTipo) return false;
      if (filterStep !== '' && p.step_idx !== Number(filterStep)) return false;
      return true;
    });
  }, [all, filterTipo, filterStep]);

  const kpis = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const p of all) {
      if (p.step_idx >= 0 && p.step_idx < counts.length) counts[p.step_idx]++;
    }
    return counts;
  }, [all]);

  const tiposDistinct = useMemo(() => {
    const s = new Set<string>();
    for (const p of all) if (p.tipo_label) s.add(p.tipo_label);
    return Array.from(s).sort();
  }, [all]);

  async function handleSave(values: PagoInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Pago actualizado.');
      } else {
        await create.mutateAsync(values);
        toast.success('Pago creado.');
      }
      setEditing(undefined);
    } catch (e) {
      toast.error(describeError(e));
    }
  }
  async function handleAdvance(pago: Pago) {
    try { await advance.mutateAsync({ id: pago.id, current: pago }); }
    catch (e) { toast.error(describeError(e)); }
  }
  async function handleUpload(pago: Pago, file: File | null) {
    if (!file) return;
    try { await upload.mutateAsync({ id: pago.id, file }); toast.success('Comprobante cargado.'); }
    catch (e) { toast.error(describeError(e)); }
  }
  async function handleDelete(pago: Pago) {
    const ok = await confirm({
      title: 'Borrar pago',
      message: <>¿Borrar <strong>{pago.serial ?? pago.proveedor ?? pago.id}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try { await remove.mutateAsync(pago.id); toast.success('Borrado.'); }
    catch (e) { toast.error(describeError(e, 'delete')); }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">Pagos · Solicitudes</h2>
          <p className="mt-1 text-sm text-dark-2">
            Flujo de 6 pasos: Generado → Firma → Firmado → Presentado → Procesado → Pagado.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
          >
            + Nueva solicitud
          </button>
        )}
      </header>

      {/* KPIs por paso */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {PAGO_STEPS.map((label, i) => (
          <KPI
            key={label}
            label={label}
            value={kpis[i]}
            tone={i === PAGO_STEPS.length - 1 ? 'success' : i === 0 ? 'default' : 'warn'}
          />
        ))}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-2 rounded-md border border-sand bg-white p-3 sm:grid-cols-3">
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="rounded border border-sand px-2 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {tiposDistinct.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStep} onChange={(e) => setFilterStep(e.target.value)} className="rounded border border-sand px-2 py-1.5 text-sm">
          <option value="">Todos los pasos</option>
          {PAGO_STEPS.map((s, i) => <option key={s} value={i}>{i + 1}. {s}</option>)}
        </select>
        <button
          type="button"
          onClick={() => { setFilterTipo(''); setFilterStep(''); }}
          className="rounded-md border border-sand px-3 py-1.5 text-xs font-semibold text-dark-2 hover:bg-sand-l"
        >
          Limpiar filtros
        </button>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-dark-3">Cargando…</p>
      ) : query.isError ? (
        <p className="text-sm text-rust">Error: {describeError(query.error)}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-sand bg-white p-6 text-center text-sm text-dark-3">Sin pagos.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => {
            const isLast = p.step_idx >= PAGO_STEPS.length - 1;
            const tipoColor = p.tipo_label ? PAGO_TIPO_COLORS[p.tipo_label] : undefined;
            return (
              <li key={p.id} className="rounded-card border border-sand bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.serial && <span className="font-mono text-xs font-semibold text-teal-d">{p.serial}</span>}
                      {p.tipo_label && tipoColor && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ color: tipoColor.fg, background: tipoColor.bg }}
                        >
                          {p.tipo_label}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${estadoBg[p.estado]}`}>
                        {p.estado}
                      </span>
                    </div>
                    <h3 className="mt-1 font-medium text-dark">
                      {p.proveedor ?? '(sin proveedor)'}
                      {p.nit && <span className="ml-2 text-xs text-dark-3">NIT {p.nit}</span>}
                    </h3>
                    {p.concepto && <p className="text-sm text-dark-2">{p.concepto}</p>}
                    <p className="mt-1 text-xs text-dark-3">
                      {formatDate(p.fecha)} · <span className="font-mono font-semibold">{fmt(Number(p.monto), p.moneda)}</span>
                      {p.cotizacion && <> · TC {p.cotizacion}</>}
                      {p.pct_anticipo && p.pct_anticipo > 0 && <> · Anticipo {p.pct_anticipo}%</>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setViewing(p)}
                      className="rounded-md border border-teal/40 px-2 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
                      title="Ver PDF"
                    >
                      👁
                    </button>
                    {canEdit && (
                      <>
                      {!isLast && (
                        <button
                          type="button"
                          onClick={() => void handleAdvance(p)}
                          className="rounded-md bg-teal px-3 py-1 text-xs font-semibold text-white hover:bg-teal-d"
                        >
                          → Siguiente
                        </button>
                      )}
                      {isLast && (
                        <span className="rounded-md bg-teal px-3 py-1 text-xs font-semibold text-white">✓ Pagado</span>
                      )}
                      {p.step_idx >= PAGO_STEPS.length - 1 && !p.comprobante_storage_path && (
                        <>
                          <input
                            ref={(el) => (fileInputs.current[p.id] = el)}
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => void handleUpload(p, e.target.files?.[0] ?? null)}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputs.current[p.id]?.click()}
                            className="rounded-md border border-teal/40 px-3 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
                          >
                            📎 Comprobante
                          </button>
                        </>
                      )}
                      {p.comprobante_storage_path && (
                        <span className="rounded-md bg-teal-l px-2 py-1 text-xs font-semibold text-teal-d">📎 ✓</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="rounded-md border border-sand px-2 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(p)}
                        className="rounded-md border border-rust/40 px-2 py-1 text-xs font-semibold text-rust hover:bg-rust-l"
                      >
                        ×
                      </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <StepTracker steps={PAGO_STEPS} currentIdx={p.step_idx} stepDates={p.step_dates} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing?.id ? `Editar pago — ${editing.serial ?? editing.proveedor ?? ''}` : 'Nueva solicitud de pago'}
        size="xl"
      >
        <PagoForm
          initial={editing ?? null}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSave}
          onCancel={() => setEditing(undefined)}
        />
      </Modal>

      <PrintableModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.serial ?? 'Pago'}
      >
        {viewing && <PagoPrintable pago={viewing} />}
      </PrintableModal>
    </section>
  );
}
