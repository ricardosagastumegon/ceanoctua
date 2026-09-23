import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { PaymentMethodSelect } from '../shared/PaymentMethodSelect';
import { attRentasByViajeKey, attRentasKey } from './hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { ESTATUS_PAGO } from '../tickets/full-api';
import {
  COMBUSTIBLES,
  TRANSMISIONES,
  diasEntre,
  leerExtras,
  rentaFullApi,
  subirConfirmacionRenta,
  totalRenta,
  type AttRentaInsert,
  type ExtraInput,
} from './full-api';
import type { Database } from '@/types/database';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.renta;

type Props = {
  open: boolean;
  viajeId: string;
  rentaId?: string;
  onClose: () => void;
};

/**
 * Formulario de renta de vehículo.
 *
 * Los días se calculan de recepción a entrega, pero quedan editables: hay
 * rentadoras que cobran por día calendario y otras por 24 horas, así que el
 * número que manda es el del contrato, no el del calendario.
 */
export function RentaFormModal({ open, viajeId, rentaId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_renta_full', rentaId],
    queryFn: () => rentaFullApi.load(rentaId as string),
    enabled: open && !!rentaId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof rentaFullApi.save>[0]) => rentaFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: attRentasKey });
      void qc.invalidateQueries({ queryKey: attRentasByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: ['att_renta_full', id] });
      void qc.invalidateQueries({ queryKey: ['att_service_counts', viajeId] });
      void qc.invalidateQueries({ queryKey: ['att_itinerary_events', viajeId] });
    },
  });

  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoVeh, setTipoVeh] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [tamano, setTamano] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [puertas, setPuertas] = useState('');
  const [transmision, setTransmision] = useState('');
  const [combustible, setCombustible] = useState('');
  const [descVeh, setDescVeh] = useState('');
  const [reservado, setReservado] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [recepcionFecha, setRecepcionFecha] = useState('');
  const [recepcionHora, setRecepcionHora] = useState('');
  const [recepcionDir, setRecepcionDir] = useState('');
  const [entregaFecha, setEntregaFecha] = useState('');
  const [entregaHora, setEntregaHora] = useState('');
  const [entregaDir, setEntregaDir] = useState('');
  const [dias, setDias] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [deposito, setDeposito] = useState('');
  const [extras, setExtras] = useState<ExtraInput[]>([]);
  const [cancelacion, setCancelacion] = useState('');
  const [estatusNota, setEstatusNota] = useState('');
  const [estadoPago, setEstadoPago] = useState('HOLD');
  const [pagadoCon, setPagadoCon] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [error, setError] = useState<string | null>(null);

  const diasCalculados = useMemo(
    () => diasEntre(recepcionFecha, entregaFecha),
    [recepcionFecha, entregaFecha],
  );
  const total = useMemo(
    () => totalRenta(tarifa, dias, deposito, extras),
    [tarifa, dias, deposito, extras],
  );

  useEffect(() => {
    if (!open) return;
    const r = cargado.data;
    setNombre(r?.nombre ?? '');
    setCiudad(r?.ciudad ?? '');
    setDireccion(r?.direccion ?? '');
    setTelefono(r?.telefono ?? '');
    setTipoVeh(r?.tipo_veh ?? '');
    setMarca(r?.marca ?? '');
    setModelo(r?.modelo ?? '');
    setTamano(r?.tamano ?? '');
    setCapacidad(r?.capacidad ?? '');
    setPuertas(r?.puertas != null ? String(r.puertas) : '');
    setTransmision(r?.transmision ?? '');
    setCombustible(r?.combustible ?? '');
    setDescVeh(r?.desc_veh ?? '');
    setReservado(r?.reservado ?? '');
    setReservaNombre(r?.reserva_nombre ?? '');
    setConfirmacion(r?.confirmacion ?? '');
    setRecepcionFecha(r?.recepcion_fecha ?? '');
    setRecepcionHora(r?.recepcion_hora ?? '');
    setRecepcionDir(r?.recepcion_dir ?? '');
    setEntregaFecha(r?.entrega_fecha ?? '');
    setEntregaHora(r?.entrega_hora ?? '');
    setEntregaDir(r?.entrega_dir ?? '');
    setDias(r?.dias != null ? String(r.dias) : '');
    setTarifa(r?.tarifa != null ? String(r.tarifa) : '');
    setDeposito(r?.deposito != null ? String(r.deposito) : '');
    setExtras(leerExtras(r?.extras));
    setCancelacion(r?.cancelacion ?? '');
    setEstatusNota(r?.estatus_pago ?? '');
    setEstadoPago(r?.estado_pago ?? 'HOLD');
    setPagadoCon(r?.pagado_con ?? '');
    setMoneda((r?.moneda as Currency) ?? 'USD');
    setError(null);
  }, [open, cargado.data]);

  // Al fijar las fechas se propone el número de días, sin pisar lo escrito.
  useEffect(() => {
    if (diasCalculados > 0 && !dias) setDias(String(diasCalculados));
  }, [diasCalculados, dias]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre de la rentadora es obligatorio.');
    if (recepcionFecha && entregaFecha && entregaFecha < recepcionFecha) {
      return setError('La entrega no puede ser anterior a la recepción.');
    }
    setError(null);

    const cabecera: AttRentaInsert = {
      viaje_id: viajeId,
      nombre: nombre.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      tipo_veh: tipoVeh.trim() || null,
      marca: marca.trim() || null,
      modelo: modelo.trim() || null,
      tamano: tamano.trim() || null,
      capacidad: capacidad.trim() || null,
      puertas: puertas.trim() === '' ? null : Number(puertas),
      transmision: transmision || null,
      combustible: combustible || null,
      desc_veh: descVeh.trim() || null,
      reservado: reservado.trim() || null,
      reserva_nombre: reservaNombre.trim() || null,
      confirmacion: confirmacion.trim() || null,
      recepcion_fecha: recepcionFecha || null,
      recepcion_hora: recepcionHora || null,
      recepcion_dir: recepcionDir.trim() || null,
      entrega_fecha: entregaFecha || null,
      entrega_hora: entregaHora || null,
      entrega_dir: entregaDir.trim() || null,
      dias: dias.trim() === '' ? null : Number(dias),
      tarifa: tarifa.trim() === '' ? null : Number(tarifa),
      deposito: deposito.trim() === '' ? null : Number(deposito),
      extras: extras
        .filter((e) => e.label.trim() || e.amount.trim())
        .map((e) => ({ label: e.label.trim(), amount: Number(e.amount) || 0 })),
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusNota.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon.trim() || null,
      moneda,
    };

    try {
      await save.mutateAsync({ id: rentaId, cabecera });
      toast.success(rentaId ? 'Renta actualizada.' : 'Renta agregada.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${rentaId ? 'Editar' : 'Nueva'} Renta de Vehículo`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando renta…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="La rentadora">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Nombre de la rentadora *" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Hertz" autoFocus />
              <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </Bloque>

          {/* ── El vehículo ─────────────────────────────────────────── */}
          <Bloque titulo="Información del vehículo">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Tipo de vehículo" value={tipoVeh} onChange={(e) => setTipoVeh(e.target.value)} placeholder="SUV, sedán…" />
              <TextInput label="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
              <TextInput label="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Tamaño" value={tamano} onChange={(e) => setTamano(e.target.value)} placeholder="Compacto, full size…" />
              <TextInput label="Capacidad" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} placeholder="5 pasajeros" />
              <TextInput label="No. de puertas" type="number" min="0" value={puertas} onChange={(e) => setPuertas(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Transmisión" value={transmision} onChange={(e) => setTransmision(e.target.value)}>
                <option value="">— elegir —</option>
                {TRANSMISIONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Select label="Combustible" value={combustible} onChange={(e) => setCombustible(e.target.value)}>
                <option value="">— elegir —</option>
                {COMBUSTIBLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <TextArea label="Descripción del vehículo" value={descVeh} onChange={(e) => setDescVeh(e.target.value)} rows={2} />
          </Bloque>

          {/* ── La reserva ──────────────────────────────────────────── */}
          <Bloque titulo="La reserva">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Reservado a través de" value={reservado} onChange={(e) => setReservado(e.target.value)} placeholder="Agencia / plataforma" />
              <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} />
              <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
            </div>

            <div className="rounded-md p-3" style={{ backgroundColor: META.light }}>
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                Recepción
              </div>
              <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TextInput label="Fecha" type="date" value={recepcionFecha} onChange={(e) => setRecepcionFecha(e.target.value)} />
                <TextInput label="Hora (24h)" type="time" value={recepcionHora} onChange={(e) => setRecepcionHora(e.target.value)} />
                <TextInput label="Dirección de recepción" value={recepcionDir} onChange={(e) => setRecepcionDir(e.target.value)} />
              </div>
            </div>

            <div className="rounded-md p-3" style={{ backgroundColor: META.light }}>
              <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                Entrega
              </div>
              <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TextInput label="Fecha" type="date" value={entregaFecha} min={recepcionFecha || undefined} onChange={(e) => setEntregaFecha(e.target.value)} />
                <TextInput label="Hora (24h)" type="time" value={entregaHora} onChange={(e) => setEntregaHora(e.target.value)} />
                <TextInput label="Dirección de entrega" value={entregaDir} onChange={(e) => setEntregaDir(e.target.value)} />
              </div>
            </div>

            <TextInput label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} placeholder="Política de cancelación" />
          </Bloque>

          {/* ── Montos ──────────────────────────────────────────────── */}
          <Bloque titulo="Montos">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                <option value="USD">USD</option>
                <option value="GTQ">GTQ</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
              <TextInput
                label="Cantidad de días"
                type="number"
                min="0"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                hint={diasCalculados > 0 ? `${diasCalculados} según las fechas` : undefined}
              />
              <TextInput label={`Tarifa por día (${moneda})`} type="number" min="0" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
              <TextInput label={`Depósito de seguridad (${moneda})`} type="number" min="0" step="0.01" value={deposito} onChange={(e) => setDeposito(e.target.value)} />
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">Extras</div>
              <p className="text-[11px] text-dark-3">Seguros, sillas para niños, GPS…</p>
              {extras.map((x, i) => (
                <div key={i} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[3fr_1fr_auto]">
                  <input
                    type="text"
                    value={x.label}
                    onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)))}
                    placeholder="Nombre del extra"
                    className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={x.amount}
                    onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, amount: e.target.value } : y)))}
                    placeholder={`${moneda} 0.00`}
                    className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setExtras((l) => l.filter((_, k) => k !== i))}
                    className="rounded-md border border-sand px-2 py-2 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
                    aria-label="Quitar extra"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setExtras((l) => [...l, { label: '', amount: '' }])}
                className="mt-2 rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-80"
                style={{ borderColor: META.solid, color: META.dark }}
              >
                ＋ Agregar extra
              </button>
            </div>
          </Bloque>

          <div
            className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
            style={{ background: META.grad ?? META.dark }}
          >
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
                🚗 Total de la reserva
              </div>
              <div className="text-[11px] text-white/60">
                {moneda} {Number(tarifa || 0).toFixed(2)} × {dias || 0} día{dias === '1' ? '' : 's'}
                {Number(deposito) > 0 ? ' + depósito' : ''}
                {extras.length > 0 ? ' + extras' : ''}
              </div>
            </div>
            <div className="font-heading text-2xl font-extrabold">
              {moneda} {total.toFixed(2)}
            </div>
          </div>

          <Bloque titulo="Pago">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Estatus del pago" value={estatusNota} onChange={(e) => setEstatusNota(e.target.value)} placeholder="Ej: Depósito 50% pagado" />
              <Select label="Estado" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)}>
                {ESTATUS_PAGO.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <PaymentMethodSelect label="Pagado con" value={pagadoCon} onChange={setPagadoCon} />
          </Bloque>

          <Bloque titulo="Confirmación">
            {rentaId ? (
              <ConfirmacionBoton id={rentaId} actual={cargado.data?.confirmacion_path} />
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda la renta primero — el archivo se guarda bajo su número.
              </p>
            )}
          </Bloque>

          {error && (
            <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              style={{ backgroundColor: META.solid }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? 'Guardando…' : '💾 Guardar Renta'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-md border border-sand p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: META.dark }}>
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

function ConfirmacionBoton({ id, actual }: { id: string; actual?: string | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setSubiendo(true);
    try {
      await subirConfirmacionRenta(id, file);
      await qc.invalidateQueries({ queryKey: ['att_renta_full', id] });
      toast.success('Confirmación cargada.');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={subiendo}
        className="w-full rounded-md border border-dashed px-3 py-3 text-xs font-semibold disabled:opacity-60"
        style={{ borderColor: META.solid, color: META.dark, backgroundColor: META.light }}
      >
        {subiendo ? 'Subiendo…' : '📎 Subir confirmación (PDF/imagen)'}
        <span className="mt-0.5 block text-[10px] font-normal text-dark-3">
          {actual ? 'Cargada — subir otra la reemplaza' : 'Sin archivo'}
        </span>
      </button>
    </div>
  );
}
