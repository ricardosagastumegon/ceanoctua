import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { PaymentMethodSelect } from '../shared/PaymentMethodSelect';
import { SERVICE_META } from '../constants/serviceMeta';
import { ESTATUS_PAGO } from '../tickets/full-api';
import { cargarPorId, subirReporteConsumo, urlReporteConsumo } from './api';
import { useCreateAttConsumoVarios, useUpdateAttConsumoVarios } from './hooks';
import type { Database } from '@/types/database';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.varios;

type Props = {
  open: boolean;
  viajeId: string;
  consumoId?: string;
  onClose: () => void;
};

/** Formulario del consumo varios: un total bajo un concepto. */
export function ConsumoVariosFormModal({ open, viajeId, consumoId, onClose }: Props) {
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_consumo_varios', consumoId],
    queryFn: () => cargarPorId(consumoId as string),
    enabled: open && !!consumoId,
  });
  const create = useCreateAttConsumoVarios();
  const update = useUpdateAttConsumoVarios();

  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [fecha, setFecha] = useState('');
  const [fechaCargo, setFechaCargo] = useState('');
  const [estadoPago, setEstadoPago] = useState('CONFIRMADO');
  const [pagadoCon, setPagadoCon] = useState('');
  const [pagadoConId, setPagadoConId] = useState<string | null>(null);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const c = cargado.data;
    setConcepto(c?.concepto ?? '');
    setMonto(c?.monto != null ? String(c.monto) : '');
    setMoneda((c?.moneda as Currency) ?? 'USD');
    setFecha(c?.fecha ?? '');
    setFechaCargo(c?.fecha_cargo ?? '');
    setEstadoPago(c?.estado_pago ?? 'CONFIRMADO');
    setPagadoCon(c?.pagado_con ?? '');
    setPagadoConId(c?.pagado_con_id ?? null);
    setNotas(c?.notas ?? '');
    setError(null);
  }, [open, cargado.data]);

  const guardando = create.isPending || update.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!concepto.trim()) return setError('El concepto es obligatorio.');
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return setError('El monto tiene que ser mayor que cero.');
    setError(null);

    const campos = {
      concepto: concepto.trim(),
      monto: n,
      moneda,
      fecha: fecha || null,
      fecha_cargo: fechaCargo || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon.trim() || null,
      pagado_con_id: pagadoConId,
      notas: notas.trim() || null,
    };

    try {
      if (consumoId) {
        await update.mutateAsync({ id: consumoId, patch: campos });
        toast.success('Consumos varios actualizado.');
      } else {
        await create.mutateAsync({ viaje_id: viajeId, ...campos });
        toast.success('Consumos varios agregado.');
      }
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${consumoId ? 'Editar' : 'Nuevos'} Consumos Varios`}
      size="lg"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="El concepto">
            <TextInput
              label="Concepto *"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: CONSUMOS VARIOS Sra. Arriaza"
              hint="Un renglón por reporte y por tarjeta. Si el reporte mezcla dos tarjetas, va en dos."
              autoFocus
            />
            <TextInput
              label="Fecha del reporte"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              hint="El día que te entregaron el reporte, o el corte del viaje."
            />
          </Bloque>

          <Bloque titulo="El monto">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                {(['USD', 'GTQ', 'EUR', 'GBP'] as const).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <TextInput
                  label={`Total del reporte (${moneda}) *`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
              </div>
            </div>
          </Bloque>

          <div
            className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
            style={{ background: META.grad }}
          >
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
                {META.icon} Total de consumos varios
              </div>
              <div className="text-[11px] text-white/60">
                Entra completo a la liquidación del viaje y al consumo de la tarjeta.
              </div>
            </div>
            <div className="font-heading text-2xl font-extrabold">
              {moneda} {(Number(monto) || 0).toFixed(2)}
            </div>
          </div>

          <Bloque titulo="Pago">
            <PaymentMethodSelect
              label="Pagado con"
              value={pagadoCon}
              valueId={pagadoConId}
              onChange={(texto, tarjetaId) => {
                setPagadoCon(texto);
                setPagadoConId(tarjetaId);
              }}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Estado" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)}>
                {ESTATUS_PAGO.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <TextInput
                label="Fecha de cargo a la tarjeta"
                type="date"
                value={fechaCargo}
                onChange={(e) => setFechaCargo(e.target.value)}
                hint="Cuándo pegó en el estado de cuenta."
              />
            </div>
          </Bloque>

          <Bloque titulo="El detalle">
            <TextArea
              label="Notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              placeholder="Ej: propinas, taxis, farmacia, lavandería del hotel…"
              hint="Sale en la hoja imprimible. No afecta la suma: el monto es el monto."
            />
          </Bloque>

          <Bloque titulo="El reporte entregado">
            {consumoId ? (
              <ReporteBoton
                id={consumoId}
                actual={cargado.data?.reporte_path}
                onSubido={() => void cargado.refetch()}
              />
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda primero — el archivo se guarda bajo el número del registro.
              </p>
            )}
          </Bloque>

          {error && (
            <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              style={{ backgroundColor: META.solid }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : '💾 Guardar Consumos Varios'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-md border border-sand p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: META.dark }}>
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * El reporte escaneado que le entregan.
 *
 * El bucket es privado, así que el enlace para verlo se pide al hacer clic y
 * dura una hora. Subir otro archivo reemplaza el anterior: si el reporte
 * viene en dos partes, van en un solo PDF o en dos renglones.
 */
function ReporteBoton({
  id,
  actual,
  onSubido,
}: {
  id: string;
  actual?: string | null;
  onSubido: () => void;
}) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setSubiendo(true);
    try {
      await subirReporteConsumo(id, file);
      onSubido();
      toast.success('Reporte cargado.');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function abrir() {
    if (!actual) return;
    try {
      window.open(await urlReporteConsumo(actual), '_blank', 'noopener');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={subiendo}
        className="w-full rounded-md border border-dashed px-3 py-3 text-xs font-semibold disabled:opacity-60"
        style={{ borderColor: META.solid, color: META.dark, backgroundColor: META.light }}
      >
        {subiendo ? 'Subiendo…' : '📎 Subir el reporte (PDF/imagen)'}
        <span className="mt-0.5 block text-[10px] font-normal text-dark-3">
          {actual ? 'Cargado — subir otro lo reemplaza' : 'Sin archivo'}
        </span>
      </button>
      {actual && (
        <button
          type="button"
          onClick={() => void abrir()}
          className="text-[11px] font-extrabold underline"
          style={{ color: META.dark }}
        >
          Ver el reporte cargado
        </button>
      )}
    </div>
  );
}
