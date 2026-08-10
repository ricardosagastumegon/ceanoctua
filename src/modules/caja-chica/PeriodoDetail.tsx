import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/money';
import { useAuth } from '@/lib/auth';
import {
  useLineas,
  useCreateLinea,
  useUpdateLinea,
  useDeleteLinea,
  useValeFacturasByPeriodo,
} from './hooks';
import {
  consumoLinea,
  totalLinea,
  type FormaPago,
  type Linea,
  type LineaUpdate,
  type Periodo,
  type ValeFactura,
} from './types';
import { LiquidarValeModal } from './LiquidarValeModal';

const FORMAS_PAGO: FormaPago[] = ['Efectivo', 'Caja chica', 'Transferencia', 'Cheque', 'Tarjeta', 'Vale', 'Otro'];

// Solicitantes sugeridos — el user puede escribir libre (input text, no select).
type Props = {
  periodo: Periodo;
  onBack: () => void;
};

export function PeriodoDetail({ periodo, onBack }: Props) {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';

  const lineas = useLineas(periodo.id);
  const facturas = useValeFacturasByPeriodo(periodo.id);
  const create = useCreateLinea();
  const update = useUpdateLinea(periodo.id);
  const remove = useDeleteLinea(periodo.id);
  const toast = useToast();

  const [liquidando, setLiquidando] = useState<Linea | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LineaUpdate>({});

  // Agrupar sub-facturas por linea_id.
  const facturasByLinea = useMemo(() => {
    const m = new Map<string, ValeFactura[]>();
    for (const f of facturas.data ?? []) {
      const arr = m.get(f.linea_id) ?? [];
      arr.push(f);
      m.set(f.linea_id, arr);
    }
    return m;
  }, [facturas.data]);

  const items = lineas.data ?? [];
  const gastado = items.reduce((s, l) => s + consumoLinea(l, facturasByLinea.get(l.id) ?? []), 0);
  const saldo = Number(periodo.monto_inicial) - gastado;
  const valeAbiertoCount = items.filter((l) => l.forma_pago === 'Vale' && l.vale_estado === 'Abierto').length;

  async function handleAgregarLinea() {
    try {
      const row = await create.mutateAsync({
        periodo_id: periodo.id,
        fecha: new Date().toISOString().slice(0, 10),
        forma_pago: 'Caja chica',
        cantidad: 1,
        p_unitario: 0,
        orden: items.length,
      });
      // Abrir en modo edit inmediatamente.
      setEditingId(row.id);
      setDraft({});
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function beginEdit(l: Linea) {
    setEditingId(l.id);
    setDraft({});
  }

  async function saveEdit(id: string) {
    if (Object.keys(draft).length === 0) {
      setEditingId(null);
      return;
    }
    try {
      await update.mutateAsync({ id, patch: draft });
      setEditingId(null);
      setDraft({});
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  async function handleDelete(l: Linea) {
    if (!window.confirm(`¿Eliminar la línea "${l.nombre ?? '(sin nombre)'}"?`)) return;
    try {
      await remove.mutateAsync(l.id);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-sand bg-gradient-to-br from-navy to-teal-d p-5 text-white shadow-lg">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 text-xs font-semibold text-white/70 hover:text-white"
        >
          ← Ver todos los períodos
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">Caja Chica</div>
            <div className="mt-0.5 font-heading text-2xl font-bold">
              {periodo.serial ?? '—'} · {periodo.titulo ?? '(sin título)'}
            </div>
            <div className="mt-1 text-xs text-white/70">Fecha: {periodo.fecha}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCell label="Monto inicial" value={formatMoney(Number(periodo.monto_inicial))} tone="neutral" />
            <StatCell label="Gastado" value={formatMoney(gastado)} tone="rust" />
            <StatCell
              label="Saldo"
              value={formatMoney(saldo)}
              tone={saldo < 0 ? 'rust' : 'ok'}
            />
          </div>
        </div>
        {valeAbiertoCount > 0 && (
          <div className="mt-3 rounded-md border border-rust/40 bg-rust/20 px-3 py-2 text-xs font-semibold">
            ⚠ Hay {valeAbiertoCount} vale{valeAbiertoCount === 1 ? '' : 's'} sin liquidar. El saldo mostrado los descuenta por su monto original.
          </div>
        )}
      </div>

      {/* Tabla de líneas */}
      <div className="overflow-x-auto rounded-lg border border-sand bg-white shadow-sm">
        <table className="w-full min-w-[1400px] text-sm">
          <thead className="bg-navy text-white">
            <tr>
              <Th className="w-10">#</Th>
              <Th className="w-28">Fecha</Th>
              <Th className="w-28">No. Factura</Th>
              <Th>Nombre / Producto</Th>
              <Th className="w-20 text-right">Cant.</Th>
              <Th className="w-28 text-right">P. Unit</Th>
              <Th className="w-28 text-right">Total</Th>
              <Th className="w-32">Solicitante</Th>
              <Th className="w-32">Lugar</Th>
              <Th className="w-28">Forma pago</Th>
              <Th className="w-40">Observaciones</Th>
              <Th className="w-32">Vale</Th>
              {canEdit && <Th className="w-32 text-center">Acciones</Th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !lineas.isLoading && (
              <tr>
                <td colSpan={canEdit ? 13 : 12} className="px-4 py-8 text-center italic text-dark-3">
                  Sin líneas todavía. Haz clic en "+ Agregar línea" para empezar.
                </td>
              </tr>
            )}
            {items.map((l, i) => {
              const isEditing = editingId === l.id;
              // Vista efectiva: draft > row original (solo cuando editing).
              const view: Linea = isEditing ? { ...l, ...draft } : l;
              const total = totalLinea(view);
              const isValeAbierto = l.forma_pago === 'Vale' && l.vale_estado === 'Abierto';
              const isValeLiq = l.forma_pago === 'Vale' && l.vale_estado === 'Liquidado';
              const esOtro = view.forma_pago === 'Otro';
              const rowBg = isEditing
                ? 'bg-gold-light/40'
                : isValeAbierto
                ? 'bg-rust/10'
                : isValeLiq
                ? 'bg-teal-l/40'
                : '';
              return (
                <tr key={l.id} className={`border-t border-sand ${rowBg}`}>
                  <Td className="text-center text-xs text-dark-3">{i + 1}</Td>
                  <Td>
                    <CellInput
                      type="date"
                      value={view.fecha ?? ''}
                      editing={isEditing}
                      onChange={(v) => setDraft({ ...draft, fecha: v || null })}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      type="text"
                      value={view.factura ?? ''}
                      editing={isEditing}
                      placeholder="Nº"
                      onChange={(v) => setDraft({ ...draft, factura: v || null })}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      type="text"
                      value={view.nombre ?? ''}
                      editing={isEditing}
                      placeholder="Nombre / producto"
                      onChange={(v) => setDraft({ ...draft, nombre: v || null })}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      type="number"
                      value={String(view.cantidad ?? '')}
                      editing={isEditing}
                      placeholder="1"
                      right
                      onChange={(v) => setDraft({ ...draft, cantidad: v === '' ? null : Number(v) })}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      type="number"
                      value={String(view.p_unitario ?? '')}
                      editing={isEditing}
                      placeholder="0.00"
                      right
                      onChange={(v) => setDraft({ ...draft, p_unitario: v === '' ? null : Number(v) })}
                    />
                  </Td>
                  <Td className="bg-teal-l text-right font-mono font-bold text-teal-d">{formatMoney(total)}</Td>
                  <Td>
                    <CellInput
                      type="text"
                      value={view.solicitante ?? ''}
                      editing={isEditing}
                      placeholder="Nombre"
                      onChange={(v) => setDraft({ ...draft, solicitante: v || null })}
                    />
                  </Td>
                  <Td>
                    <CellInput
                      type="text"
                      value={view.lugar ?? ''}
                      editing={isEditing}
                      placeholder="Lugar"
                      onChange={(v) => setDraft({ ...draft, lugar: v || null })}
                    />
                  </Td>
                  <Td>
                    {isEditing ? (
                      <select
                        value={view.forma_pago}
                        onChange={(e) => setDraft({ ...draft, forma_pago: e.target.value as FormaPago })}
                        className="w-full rounded border border-sand-d bg-white px-1 py-0.5 text-xs"
                      >
                        {FORMAS_PAGO.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          view.forma_pago === 'Vale'
                            ? isValeAbierto
                              ? 'bg-rust text-white'
                              : 'bg-teal text-white'
                            : 'bg-sand text-dark'
                        }`}
                      >
                        {view.forma_pago}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <CellInput
                      type="text"
                      value={view.observaciones ?? ''}
                      editing={isEditing}
                      placeholder={esOtro ? '(requerido si "Otro")' : 'Notas'}
                      onChange={(v) => setDraft({ ...draft, observaciones: v || null })}
                      className={esOtro ? 'bg-gold-light/50 border-gold' : ''}
                    />
                  </Td>
                  <Td>
                    {l.forma_pago === 'Vale' ? (
                      <button
                        type="button"
                        onClick={() => setLiquidando(l)}
                        className={`rounded-md px-2 py-1 text-[10px] font-bold text-white ${
                          isValeAbierto ? 'bg-rust hover:bg-rust/80' : 'bg-teal hover:bg-teal-d'
                        }`}
                        title={isValeAbierto ? 'Liquidar vale con facturas' : 'Ver liquidación'}
                      >
                        {isValeAbierto ? '💰 Liquidar' : '✓ Liquidado'}
                      </button>
                    ) : (
                      <span className="text-xs text-dark-3">—</span>
                    )}
                  </Td>
                  {canEdit && (
                    <Td className="text-center">
                      {isEditing ? (
                        <div className="flex justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => void saveEdit(l.id)}
                            className="rounded border border-teal bg-teal-l px-2 py-0.5 text-[10px] font-bold text-teal-d hover:bg-teal hover:text-white"
                            title="Guardar cambios"
                          >
                            💾
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded border border-rust/40 px-2 py-0.5 text-[10px] font-bold text-rust hover:bg-rust-l"
                            title="Cancelar"
                          >
                            ↩
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => beginEdit(l)}
                            className="rounded border border-sand px-2 py-0.5 text-[10px] font-bold text-dark-2 hover:bg-sand-l"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(l)}
                            className="rounded border border-rust/40 px-2 py-0.5 text-[10px] font-bold text-rust hover:bg-rust-l"
                            title="Eliminar"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="rounded-lg border-2 border-dashed border-sand-d bg-white p-4 text-center">
          <button
            type="button"
            onClick={() => void handleAgregarLinea()}
            disabled={create.isPending}
            className="rounded-md bg-teal px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-d disabled:opacity-50"
          >
            + Agregar línea
          </button>
        </div>
      )}

      <LiquidarValeModal
        linea={liquidando}
        periodoId={periodo.id}
        onClose={() => setLiquidando(null)}
        canEdit={canEdit}
      />
    </section>
  );
}

// ----- Sub-componentes helper -----

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1.5 text-xs ${className}`}>{children}</td>;
}

function CellInput({
  type,
  value,
  editing,
  placeholder,
  right,
  className = '',
  onChange,
}: {
  type: 'text' | 'date' | 'number';
  value: string;
  editing: boolean;
  placeholder?: string;
  right?: boolean;
  className?: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type={type}
      disabled={!editing}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded border px-1.5 py-1 text-xs ${
        editing ? 'border-sand focus:border-teal focus:ring-1 focus:ring-teal' : 'border-transparent bg-transparent'
      } ${right ? 'text-right' : ''} ${className}`}
    />
  );
}

function StatCell({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'ok' | 'rust' }) {
  const bg = tone === 'ok' ? 'bg-teal/30 border-teal/50' : tone === 'rust' ? 'bg-rust/30 border-rust/50' : 'bg-white/10 border-white/20';
  return (
    <div className={`min-w-[110px] rounded-md border px-3 py-2 ${bg}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">{label}</div>
      <div className="font-mono text-sm font-bold text-white">{value}</div>
    </div>
  );
}

// Modal para crear un nuevo período. Se exporta para uso desde la página raíz.
export function NuevoPeriodoModal({
  open,
  onClose,
  onCreate,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: { titulo: string; fecha: string; monto_inicial: number; notas: string }) => Promise<void>;
  submitting: boolean;
}) {
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState('');
  const [notas, setNotas] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(monto);
    if (!Number.isFinite(m) || m < 0) return;
    await onCreate({ titulo: titulo.trim(), fecha, monto_inicial: m, notas: notas.trim() });
    setTitulo('');
    setFecha(new Date().toISOString().slice(0, 10));
    setMonto('');
    setNotas('');
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo período de caja chica" size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="ej. Caja chica agosto"
            className="mt-1 w-full rounded-md border border-sand px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-sand px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">Monto inicial (Q)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-sand px-3 py-2 text-right text-sm font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-sand px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-sand pt-3">
          <button type="button" onClick={onClose} className="rounded-md border border-sand px-3 py-1.5 text-sm font-semibold text-dark-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-teal px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-teal-d disabled:opacity-50"
          >
            + Crear período
          </button>
        </div>
      </form>
    </Modal>
  );
}
