import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { PaymentMethodSelect } from '../shared/PaymentMethodSelect';
import { SERVICE_META } from '../constants/serviceMeta';
import { ESTATUS_PAGO } from '../tickets/full-api';
import {
  hotelFullApi,
  nochesEntre,
  subirConfirmacionHotel,
  totalEstadia,
  totalHabitacion,
  type AttHotelInsert,
  type ExtraInput,
  type HabitacionInput,
} from './full-api';
import type { Database } from '@/types/database';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.hotel;

const habitacionVacia = (noches: number): HabitacionInput => ({
  reserva_nombre: '',
  pax: '',
  tipo_hab: '',
  desayuno: '',
  tarifa: '',
  noches: noches > 0 ? String(noches) : '',
});

type Props = {
  open: boolean;
  viajeId: string;
  hotelId?: string;
  onClose: () => void;
};

/**
 * Formulario del servicio Hotel.
 *
 * Igual que el ticket: todo se captura en una sola pasada y se guarda junto.
 * Las noches del encabezado salen de las fechas y se copian a cada habitación
 * nueva, que es lo habitual — pero cada habitación conserva las suyas, porque
 * a veces alguien llega un día después.
 */
export function HotelFormModal({ open, viajeId, hotelId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_hotel_full', hotelId],
    queryFn: () => hotelFullApi.load(hotelId as string),
    enabled: open && !!hotelId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof hotelFullApi.save>[0]) => hotelFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['att_hoteles', viajeId] });
      void qc.invalidateQueries({ queryKey: ['att_hotel_full', id] });
      void qc.invalidateQueries({ queryKey: ['att_service_counts', viajeId] });
      void qc.invalidateQueries({ queryKey: ['att_itinerary_events', viajeId] });
    },
  });

  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [reservadoPor, setReservadoPor] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [habitaciones, setHabitaciones] = useState<HabitacionInput[]>([]);
  const [extras, setExtras] = useState<ExtraInput[]>([]);
  const [earlyCheckin, setEarlyCheckin] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [estatusNota, setEstatusNota] = useState('');
  const [estadoPago, setEstadoPago] = useState('HOLD');
  const [pagadoCon, setPagadoCon] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [error, setError] = useState<string | null>(null);

  const noches = useMemo(() => nochesEntre(checkin, checkout), [checkin, checkout]);
  const total = useMemo(() => totalEstadia(habitaciones, extras), [habitaciones, extras]);
  const extrasConNombre = extras.filter((e) => e.nombre.trim()).length;

  useEffect(() => {
    if (!open) return;
    const d = cargado.data;
    const h = d?.hotel;
    setNombre(h?.nombre ?? '');
    setCiudad(h?.ciudad ?? '');
    setDireccion(h?.direccion ?? '');
    setTelefono(h?.telefono ?? '');
    setReservadoPor(h?.reservado_por ?? h?.ota ?? '');
    setConfirmacion(h?.confirmacion ?? '');
    setCheckin(h?.checkin ?? '');
    setCheckout(h?.checkout ?? '');
    setHabitaciones(d?.habitaciones.length ? d.habitaciones : [habitacionVacia(0)]);
    setExtras(d?.extras ?? []);
    setEarlyCheckin(h?.early_checkin ?? '');
    setCancelacion(h?.cancel_policy ?? '');
    setEstatusNota(h?.estatus_pago ?? '');
    setEstadoPago(h?.estado_pago ?? 'HOLD');
    setPagadoCon(h?.pagado_con ?? h?.pay ?? '');
    setComentarios(h?.comentarios ?? h?.notas ?? '');
    setMoneda((h?.moneda as Currency) ?? 'USD');
    setError(null);
  }, [open, cargado.data]);

  function updHab(i: number, patch: Partial<HabitacionInput>) {
    setHabitaciones((l) => l.map((h, k) => (k === i ? { ...h, ...patch } : h)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre del hotel es obligatorio.');
    if (!checkin || !checkout) return setError('Check-in y check-out son obligatorios.');
    if (checkout <= checkin) return setError('El check-out debe ser posterior al check-in.');
    if (habitaciones.length === 0) return setError('Agrega al menos una habitación.');
    setError(null);

    const cabecera: AttHotelInsert = {
      viaje_id: viajeId,
      nombre: nombre.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      reservado_por: reservadoPor.trim() || null,
      confirmacion: confirmacion.trim() || null,
      checkin,
      checkout,
      nights: noches,
      early_checkin: earlyCheckin.trim() || null,
      cancel_policy: cancelacion.trim() || null,
      estatus_pago: estatusNota.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon.trim() || null,
      comentarios: comentarios.trim() || null,
      moneda,
    };

    try {
      await save.mutateAsync({ hotelId, cabecera, habitaciones, extras });
      toast.success(hotelId ? 'Hotel actualizado.' : 'Hotel agregado.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${hotelId ? 'Editar' : 'Nuevo'} Hotel`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando hotel…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="Encabezado">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Nombre del hotel *" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Baur au Lac" autoFocus />
              <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección completa" />
              <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Reservado a través de" value={reservadoPor} onChange={(e) => setReservadoPor(e.target.value)} placeholder="Agencia / plataforma" />
              <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Check-in (in) *" type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
              <TextInput label="Check-out (out) *" type="date" value={checkout} min={checkin || undefined} onChange={(e) => setCheckout(e.target.value)} />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
                  Cantidad de noches
                </label>
                <div className="mt-1 rounded-md px-3 py-2 text-sm font-extrabold" style={{ backgroundColor: META.light, color: META.dark }}>
                  {noches}
                </div>
              </div>
            </div>
          </Bloque>

          {/* ── Habitaciones ────────────────────────────────────────── */}
          <Bloque titulo="Habitaciones">
            {habitaciones.map((h, i) => (
              <div key={i} className="space-y-3 rounded-md border border-sand bg-sand-l/40 p-3">
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white"
                    style={{ backgroundColor: META.dark }}
                  >
                    Habitación {i + 1}
                  </span>
                  {habitaciones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setHabitaciones((l) => l.filter((_, k) => k !== i))}
                      className="rounded-md border border-sand px-2 py-1 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
                      aria-label="Quitar habitación"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextInput label="Reserva a nombre de" value={h.reserva_nombre} onChange={(e) => updHab(i, { reserva_nombre: e.target.value })} />
                  <TextInput label="Cantidad de pax" type="number" min="0" value={h.pax} onChange={(e) => updHab(i, { pax: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextInput label="Tipo de habitación" value={h.tipo_hab} onChange={(e) => updHab(i, { tipo_hab: e.target.value })} placeholder="Suite, Doble…" />
                  <TextInput label="Desayuno" value={h.desayuno} onChange={(e) => updHab(i, { desayuno: e.target.value })} placeholder="Incluido / No" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <TextInput label={`Tarifa por noche (${moneda})`} type="number" min="0" step="0.01" value={h.tarifa} onChange={(e) => updHab(i, { tarifa: e.target.value })} />
                  <TextInput label="Número de noches" type="number" min="0" value={h.noches} onChange={(e) => updHab(i, { noches: e.target.value })} />
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
                      Total por habitación
                    </label>
                    <div className="mt-1 rounded-md px-3 py-2 text-sm font-extrabold" style={{ backgroundColor: META.light, color: META.dark }}>
                      {moneda} {totalHabitacion(h).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setHabitaciones((l) => [...l, habitacionVacia(noches)])}
              className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-80"
              style={{ borderColor: META.solid, color: META.dark }}
            >
              ＋ Habitación
            </button>
          </Bloque>

          {/* ── Extras y políticas ──────────────────────────────────── */}
          <Bloque titulo="Extras y políticas">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Early check-in" value={earlyCheckin} onChange={(e) => setEarlyCheckin(e.target.value)} placeholder="Ej: Sí, desde 12:00" />
              <TextInput label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} placeholder="Política de cancelación" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">Servicios extras</div>
              {extras.map((x, i) => (
                <div key={i} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[3fr_1fr_auto]">
                  <input
                    type="text"
                    value={x.nombre}
                    onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, nombre: e.target.value } : y)))}
                    placeholder="Ej: Spa, traslado, cena…"
                    className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={x.monto}
                    onChange={(e) => setExtras((l) => l.map((y, k) => (k === i ? { ...y, monto: e.target.value } : y)))}
                    placeholder={`${moneda} 0.00`}
                    className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setExtras((l) => l.filter((_, k) => k !== i))}
                    className="rounded-md border border-sand px-2 py-2 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
                    aria-label="Quitar servicio"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setExtras((l) => [...l, { nombre: '', monto: '' }])}
                className="mt-2 rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-80"
                style={{ borderColor: META.solid, color: META.dark }}
              >
                ＋ Agregar servicio
              </button>
            </div>
          </Bloque>

          {/* ── Total de estadía ────────────────────────────────────── */}
          <div
            className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
            style={{ background: META.grad ?? META.dark }}
          >
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
                🏨 Total de estadía
              </div>
              <div className="text-[11px] text-white/60">
                {habitaciones.length} habitación{habitaciones.length === 1 ? '' : 'es'}
                {extrasConNombre > 0 ? ` · ${extrasConNombre} extra${extrasConNombre === 1 ? '' : 's'}` : ''}
              </div>
            </div>
            <div className="font-heading text-2xl font-extrabold">
              {moneda} {total.toFixed(2)}
            </div>
          </div>

          <Bloque titulo="Pago">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Estatus de pago" value={estatusNota} onChange={(e) => setEstatusNota(e.target.value)} placeholder="Ej: Depósito 50% pagado" />
              <Select label="Estado" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)}>
                {ESTATUS_PAGO.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                <option value="USD">USD</option>
                <option value="GTQ">GTQ</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </Select>
            </div>
            <PaymentMethodSelect label="Pagado con" value={pagadoCon} onChange={setPagadoCon} />
            <TextArea label="Comentarios" value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={3} placeholder="Comentarios adicionales…" />
          </Bloque>

          <Bloque titulo="Confirmación">
            {hotelId ? (
              <ConfirmacionBoton hotelId={hotelId} actual={cargado.data?.hotel?.confirmacion_path} />
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda el hotel primero — el archivo se guarda bajo su número.
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
              {save.isPending ? 'Guardando…' : '💾 Guardar Hotel'}
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

function ConfirmacionBoton({ hotelId, actual }: { hotelId: string; actual?: string | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setSubiendo(true);
    try {
      await subirConfirmacionHotel(hotelId, file);
      await qc.invalidateQueries({ queryKey: ['att_hotel_full', hotelId] });
      toast.success('Confirmación cargada.');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
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
        {subiendo ? 'Subiendo…' : '📎 Subir confirmación (PDF/imagen)'}
        <span className="mt-0.5 block text-[10px] font-normal text-dark-3">
          {actual ? 'Cargada — subir otra la reemplaza' : 'Sin archivo'}
        </span>
      </button>
    </div>
  );
}
