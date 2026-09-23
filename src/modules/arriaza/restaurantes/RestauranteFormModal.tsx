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
  diasParaCancelar,
  restauranteFullApi,
  subirConfirmacionRestaurante,
  totalConServicios,
  totalReserva,
  type AttRestauranteInsert,
  type ComensalInput,
  type PagoInput,
  type ServicioInput,
} from './full-api';
import type { Database } from '@/types/database';
import { invalidarViaje } from '../viajes/invalidar';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.restaurantes;

type Props = {
  open: boolean;
  viajeId: string;
  restauranteId?: string;
  onClose: () => void;
};

/**
 * Formulario del servicio Restaurante.
 *
 * Dos condicionantes del documento: si es Michelin aparecen las estrellas, y
 * si la cancelación es gratuita aparece la fecha límite — con aviso cuando se
 * acerca — mientras que si no lo es, se pide la penalidad.
 */
export function RestauranteFormModal({ open, viajeId, restauranteId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_restaurante_full', restauranteId],
    queryFn: () => restauranteFullApi.load(restauranteId as string),
    enabled: open && !!restauranteId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof restauranteFullApi.save>[0]) => restauranteFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['att_restaurantes', viajeId] });
      void qc.invalidateQueries({ queryKey: ['att_restaurante_full', id] });
      invalidarViaje(qc, viajeId);
    },
  });

  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [michelin, setMichelin] = useState(false);
  const [estrellas, setEstrellas] = useState(0);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [tiempoEspera, setTiempoEspera] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [detalles, setDetalles] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [reservadoPor, setReservadoPor] = useState('');
  const [cancelGratis, setCancelGratis] = useState(true);
  const [cancelFecha, setCancelFecha] = useState('');
  const [penalidad, setPenalidad] = useState('');
  const [comensales, setComensales] = useState<ComensalInput[]>([]);
  const [comensalDraft, setComensalDraft] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [tarifaPax, setTarifaPax] = useState('');
  const [servicios, setServicios] = useState<ServicioInput[]>([]);
  const [pagos, setPagos] = useState<PagoInput[]>([]);
  const [estatusNota, setEstatusNota] = useState('');
  const [estadoPago, setEstadoPago] = useState('HOLD');
  const [pagadoCon, setPagadoCon] = useState('');
  const [pagadoConId, setPagadoConId] = useState<string | null>(null);
  const [fechaCargo, setFechaCargo] = useState('');
  const [error, setError] = useState<string | null>(null);

  // El número de comensales sale de la lista: si se escribieron nombres, esos
  // mandan. Así no quedan "4 personas" con tres nombres cargados.
  const numComensales = String(comensales.length || '');
  const totalBase = useMemo(
    () => totalReserva(tarifaPax, numComensales),
    [tarifaPax, numComensales],
  );
  const total = useMemo(
    () => totalConServicios(tarifaPax, numComensales, servicios),
    [tarifaPax, numComensales, servicios],
  );
  const diasCancel = cancelGratis ? diasParaCancelar(cancelFecha) : null;

  useEffect(() => {
    if (!open) return;
    const r = cargado.data?.restaurante;
    setNombre(r?.nombre ?? '');
    setCiudad(r?.ciudad ?? '');
    setDireccion(r?.direccion ?? '');
    setTelefono(r?.phone ?? '');
    setEmail(r?.email ?? '');
    setEspecialidad(r?.specialty ?? '');
    setMichelin(r?.michelin ?? false);
    setEstrellas(r?.stars ?? 0);
    setFecha(r?.fecha ?? '');
    setHora(r?.hora ?? '');
    setTiempoEspera(r?.tiempo_espera ?? '');
    setTipoServicio(r?.tipo_servicio ?? '');
    setDetalles(r?.detalles ?? '');
    setConfirmacion(r?.conf ?? '');
    setReservadoPor(r?.reservado_por ?? '');
    setCancelGratis(r?.cancelacion_gratuita ?? true);
    setCancelFecha(r?.cancelacion_fecha ?? '');
    setPenalidad(r?.cancel_policy ?? '');
    setComensales(cargado.data?.comensales ?? []);
    setMoneda((r?.moneda as Currency) ?? 'USD');
    setTarifaPax(r?.tarifa_pax != null ? String(r.tarifa_pax) : '');
    setServicios(cargado.data?.servicios ?? []);
    setPagos(cargado.data?.pagos ?? []);
    setEstatusNota(r?.estatus_pago ?? '');
    setEstadoPago(r?.estado_pago ?? 'HOLD');
    setPagadoCon(r?.pagado_con ?? '');
    setPagadoConId(r?.pagado_con_id ?? null);
    setFechaCargo(r?.fecha_cargo ?? '');
    setComensalDraft('');
    setError(null);
  }, [open, cargado.data]);

  function addComensal() {
    const n = comensalDraft.trim();
    if (!n) return;
    setComensales((l) => [...l, { nombre: n, notas: '' }]);
    setComensalDraft('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre del restaurante es obligatorio.');
    if (!fecha) return setError('La fecha de reserva es obligatoria.');
    if (cancelGratis && cancelFecha && fecha && cancelFecha > fecha) {
      return setError('La fecha límite de cancelación no puede ser posterior a la reserva.');
    }
    setError(null);

    const cabecera: AttRestauranteInsert = {
      viaje_id: viajeId,
      nombre: nombre.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      phone: telefono.trim() || null,
      email: email.trim() || null,
      specialty: especialidad.trim() || null,
      michelin,
      stars: michelin ? estrellas : null,
      fecha,
      hora: hora || null,
      tiempo_espera: tiempoEspera.trim() || null,
      tipo_servicio: tipoServicio.trim() || null,
      detalles: detalles.trim() || null,
      conf: confirmacion.trim() || null,
      reservado_por: reservadoPor.trim() || null,
      cancelacion_gratuita: cancelGratis,
      cancelacion_fecha: cancelGratis ? cancelFecha || null : null,
      cancel_policy: cancelGratis ? null : penalidad.trim() || null,
      covers: comensales.length || null,
      moneda,
      tarifa_pax: tarifaPax.trim() === '' ? null : Number(tarifaPax),
      monto: total,
      estatus_pago: estatusNota.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon.trim() || null,
      pagado_con_id: pagadoConId,
      fecha_cargo: fechaCargo || null,
    };

    try {
      await save.mutateAsync({ id: restauranteId, cabecera, comensales, servicios, pagos });
      toast.success(restauranteId ? 'Restaurante actualizado.' : 'Restaurante agregado.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${restauranteId ? 'Editar' : 'Nuevo'} Restaurante`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando restaurante…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="El restaurante">
            <TextInput
              label="Nombre del restaurante *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Kronenhalle"
              autoFocus
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              <TextInput label="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextInput label="Especialidad" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} placeholder="Tipo de cocina" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
              <TextInput label="Ubicación" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección completa" />
            </div>

            {/* Michelin · las estrellas solo aparecen si la respuesta es sí. */}
            <div className="flex flex-wrap items-center gap-4">
              <SiNo label="Michelin" value={michelin} onChange={setMichelin} />
              {michelin && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setEstrellas(estrellas === n ? 0 : n)}
                      title={`${n} estrella${n === 1 ? '' : 's'}`}
                      className="text-xl leading-none transition-transform hover:scale-110"
                      style={{ color: n <= estrellas ? META.solid : '#d8d0bd' }}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-1 text-[11px] font-semibold text-dark-3">
                    {estrellas || 0} de 3
                  </span>
                </div>
              )}
            </div>
          </Bloque>

          <Bloque titulo="La reserva">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <TextInput label="Fecha de reserva *" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <TextInput label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              <TextInput label="Tiempo de espera" value={tiempoEspera} onChange={(e) => setTiempoEspera(e.target.value)} placeholder="Ej: 20 min" />
              <TextInput label="Tipo de servicio" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value)} placeholder="Desayuno / Cena" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Booking confirmation" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="Número de confirmación" />
              <TextInput label="Reservado a través de" value={reservadoPor} onChange={(e) => setReservadoPor(e.target.value)} placeholder="OTA o página" />
            </div>
            <TextArea label="Detalles" value={detalles} onChange={(e) => setDetalles(e.target.value)} rows={3} placeholder="Ambiente, código de vestimenta, mesa…" />

            {/* Cancelación · la condicionante del documento. */}
            <div className="rounded-md border border-sand bg-sand-l/40 p-3">
              <SiNo label="Cancelación gratuita" value={cancelGratis} onChange={setCancelGratis} />
              {cancelGratis ? (
                <div className="mt-2">
                  <TextInput
                    label="Fecha límite de cancelación"
                    type="date"
                    value={cancelFecha}
                    onChange={(e) => setCancelFecha(e.target.value)}
                  />
                  {diasCancel !== null && <AvisoCancelacion dias={diasCancel} />}
                </div>
              ) : (
                <div className="mt-2">
                  <TextInput
                    label="Penalidad por cancelación"
                    value={penalidad}
                    onChange={(e) => setPenalidad(e.target.value)}
                    placeholder="Condiciones y monto de la penalidad"
                  />
                </div>
              )}
            </div>
          </Bloque>

          {/* ── Comensales ──────────────────────────────────────────── */}
          <Bloque titulo={`Comensales · ${comensales.length}`}>
            <div className="flex gap-2">
              <input
                type="text"
                value={comensalDraft}
                onChange={(e) => setComensalDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addComensal();
                  }
                }}
                onBlur={addComensal}
                placeholder="Nombre completo del comensal"
                className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
              />
              <button
                type="button"
                onClick={addComensal}
                className="shrink-0 rounded-md border px-3 py-2 text-xs font-semibold hover:opacity-80"
                style={{ borderColor: META.solid, color: META.dark }}
              >
                ＋ Agregar
              </button>
            </div>
            {comensales.length > 0 && (
              <ol className="space-y-1">
                {comensales.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
                    style={{ backgroundColor: META.light }}
                  >
                    <span className="w-5 shrink-0 font-extrabold" style={{ color: META.dark }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-dark-2">{c.nombre}</span>
                    <button
                      type="button"
                      onClick={() => setComensales((l) => l.filter((_, k) => k !== i))}
                      className="shrink-0 text-dark-3 hover:text-rust"
                      aria-label={`Quitar ${c.nombre}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Bloque>

          {/* ── Montos ──────────────────────────────────────────────── */}
          <Bloque titulo="Montos">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                <option value="USD">USD · dólares</option>
                <option value="GTQ">GTQ · quetzales</option>
                <option value="EUR">EUR · euros</option>
                <option value="GBP">GBP · libras</option>
              </Select>
              <TextInput
                label={`Tarifa por persona (${moneda})`}
                type="number"
                min="0"
                step="0.01"
                value={tarifaPax}
                onChange={(e) => setTarifaPax(e.target.value)}
              />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
                  Precio total de reserva
                </label>
                <div
                  className="mt-1 rounded-md px-3 py-2 text-sm font-extrabold"
                  style={{ backgroundColor: META.light, color: META.dark }}
                >
                  {moneda} {totalBase.toFixed(2)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">
                Servicios adicionales
              </div>
              {servicios.map((x, i) => (
                <div key={i} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[3fr_1fr_auto]">
                  <input
                    type="text"
                    value={x.nombre}
                    onChange={(e) => setServicios((l) => l.map((y, k) => (k === i ? { ...y, nombre: e.target.value } : y)))}
                    placeholder="Ej: descorche, pastel, músicos…"
                    className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={x.monto}
                    onChange={(e) => setServicios((l) => l.map((y, k) => (k === i ? { ...y, monto: e.target.value } : y)))}
                    placeholder={`${moneda} 0.00`}
                    className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setServicios((l) => l.filter((_, k) => k !== i))}
                    className="rounded-md border border-sand px-2 py-2 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
                    aria-label="Quitar servicio"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setServicios((l) => [...l, { nombre: '', monto: '' }])}
                className="mt-2 rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-80"
                style={{ borderColor: META.solid, color: META.dark }}
              >
                ＋ Agregar servicio
              </button>
            </div>
          </Bloque>

          <div
            className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
            style={{ background: META.grad ?? META.dark }}
          >
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
                🍽 Total de reserva
              </div>
              <div className="text-[11px] text-white/60">
                {moneda} {Number(tarifaPax || 0).toFixed(2)} × {comensales.length} comensal
                {comensales.length === 1 ? '' : 'es'}
                {servicios.length > 0 ? ' + servicios adicionales' : ''}
              </div>
            </div>
            <div className="font-heading text-2xl font-extrabold">
              {moneda} {total.toFixed(2)}
            </div>
          </div>

          {/* ── Forma de pago ───────────────────────────────────────── */}
          <Bloque titulo="Forma de pago">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Estatus de pago" value={estatusNota} onChange={(e) => setEstatusNota(e.target.value)} placeholder="Ej: Depósito 50% pagado" />
              <Select label="Estado" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)}>
                {ESTATUS_PAGO.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <PaymentMethodSelect
              label="Pagado con"
              value={pagadoCon}
              valueId={pagadoConId}
              onChange={(texto, tarjetaId) => {
                setPagadoCon(texto);
                setPagadoConId(tarjetaId);
              }}
            />
            <TextInput
              label="Fecha de cargo a la tarjeta"
              type="date"
              value={fechaCargo}
              onChange={(e) => setFechaCargo(e.target.value)}
              hint="Cuándo se cobró la tarjeta. Puede ser meses antes del viaje; sirve para cuadrar contra el estado de cuenta."
            />

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">
                Registros de pago
              </div>
              <p className="text-[11px] text-dark-3">
                Uno por cobro. Si la reserva se modifica y se recobra, se agrega otro.
              </p>
              {pagos.map((p, i) => (
                <div key={i} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  {(['tc_id', 'titular', 'autorizado_por', 'monto'] as const).map((campo) => (
                    <input
                      key={campo}
                      type={campo === 'monto' ? 'number' : 'text'}
                      min={campo === 'monto' ? '0' : undefined}
                      step={campo === 'monto' ? '0.01' : undefined}
                      value={p[campo]}
                      onChange={(e) =>
                        setPagos((l) => l.map((y, k) => (k === i ? { ...y, [campo]: e.target.value } : y)))
                      }
                      placeholder={
                        campo === 'tc_id' ? 'ID de TC'
                          : campo === 'titular' ? 'Nombre'
                            : campo === 'autorizado_por' ? 'Autorizado por'
                              : `${moneda} 0.00`
                      }
                      className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setPagos((l) => l.filter((_, k) => k !== i))}
                    className="rounded-md border border-sand px-2 py-2 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
                    aria-label="Quitar registro"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPagos((l) => [...l, { tc_id: '', titular: '', autorizado_por: '', monto: '' }])}
                className="mt-2 rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-80"
                style={{ borderColor: META.solid, color: META.dark }}
              >
                ＋ Agregar registro de pago
              </button>
            </div>
          </Bloque>

          <Bloque titulo="Confirmación">
            {restauranteId ? (
              <ConfirmacionBoton id={restauranteId} actual={cargado.data?.restaurante?.confirmacion_path} />
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda el restaurante primero — el archivo se guarda bajo su número.
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
              {save.isPending ? 'Guardando…' : '💾 Guardar Restaurante'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ── Piezas ─────────────────────────────────────────────────────────── */

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

function SiNo({
  label, value, onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">{label}</div>
      <div className="mt-1 inline-flex overflow-hidden rounded-md border" style={{ borderColor: META.solid }}>
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className="px-4 py-1 text-xs font-extrabold transition-colors"
            style={
              value === v
                ? { backgroundColor: META.solid, color: '#ffffff' }
                : { backgroundColor: '#ffffff', color: META.dark }
            }
          >
            {v ? 'SÍ' : 'NO'}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Aviso de cercanía a la fecha límite de cancelación gratuita. Lo pide el
 * documento: sirve para no dejar pasar la ventana sin darse cuenta.
 */
function AvisoCancelacion({ dias }: { dias: number }) {
  if (dias < 0) {
    return (
      <p className="mt-1 rounded-md bg-rust-l px-2 py-1 text-[11px] font-semibold text-rust">
        ⚠ La cancelación gratuita venció hace {Math.abs(dias)} día{Math.abs(dias) === 1 ? '' : 's'}.
      </p>
    );
  }
  if (dias === 0) {
    return (
      <p className="mt-1 rounded-md bg-rust-l px-2 py-1 text-[11px] font-semibold text-rust">
        ⚠ Hoy vence la cancelación gratuita.
      </p>
    );
  }
  if (dias <= 5) {
    return (
      <p className="mt-1 rounded-md bg-gold-light px-2 py-1 text-[11px] font-semibold text-gold">
        ⏳ Faltan {dias} día{dias === 1 ? '' : 's'} para que venza la cancelación gratuita.
      </p>
    );
  }
  return (
    <p className="mt-1 text-[11px] text-dark-3">
      Cancelación gratuita hasta dentro de {dias} días.
    </p>
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
      await subirConfirmacionRestaurante(id, file);
      await qc.invalidateQueries({ queryKey: ['att_restaurante_full', id] });
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
