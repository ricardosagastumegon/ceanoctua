import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
import { attActividadesByViajeKey, attActividadesKey } from './hooks';
import {
  actividadesFullApi,
  subirConfirmacionActividad,
  totalActividad,
  type AttActividadInsert,
  type EntradaInput,
} from './full-api';
import type { Database } from '@/types/database';
import { invalidarViaje } from '../viajes/invalidar';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.actividades;



type Props = {
  open: boolean;
  viajeId: string;
  actividadId?: string;
  onClose: () => void;
};

/**
 * Formulario de actividad o evento.
 *
 * Lo propio de este servicio es la lista de entradas: el documento pide una
 * casilla "No. de Ticket ... si es que aplica" que, al marcarse, abre una
 * lista de nombre / número de ticket / lugar con opción de agregar varias.
 */
export function ActividadFormModal({ open, viajeId, actividadId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_actividad_full', actividadId],
    queryFn: () => actividadesFullApi.load(actividadId as string),
    enabled: open && !!actividadId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof actividadesFullApi.save>[0]) => actividadesFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: attActividadesKey });
      void qc.invalidateQueries({ queryKey: attActividadesByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: ['att_actividad_full', id] });
      invalidarViaje(qc, viajeId);
    },
  });

  const [evento, setEvento] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [reservado, setReservado] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [duracion, setDuracion] = useState('');
  const [fecha, setFecha] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [lugares, setLugares] = useState('');
  const [personas, setPersonas] = useState('');
  const [tieneTickets, setTieneTickets] = useState(false);
  const [entradas, setEntradas] = useState<EntradaInput[]>([]);
  const [inclusiones, setInclusiones] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [extras, setExtras] = useState('');
  const [montoExtras, setMontoExtras] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [estatusNota, setEstatusNota] = useState('');
  const [estadoPago, setEstadoPago] = useState('HOLD');
  const [pagadoCon, setPagadoCon] = useState('');
  const [pagadoConId, setPagadoConId] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [error, setError] = useState<string | null>(null);

  const participantesConNombre = useMemo(
    () => entradas.filter((x) => x.nombre.trim() || x.ticket.trim() || x.lugar.trim() || x.tarifa.trim()),
    [entradas],
  );
  const total = useMemo(
    () => totalActividad(participantesConNombre, tarifa, personas, montoExtras),
    [participantesConNombre, tarifa, personas, montoExtras],
  );

  useEffect(() => {
    if (!open) return;
    const a = cargado.data?.cabecera;
    setEvento(a?.evento ?? '');
    setCiudad(a?.ciudad ?? '');
    setDireccion(a?.direccion ?? '');
    setReservado(a?.reservado ?? '');
    setConfirmacion(a?.confirmacion ?? '');
    setDescripcion(a?.descripcion ?? '');
    setDuracion(a?.duracion ?? '');
    setFecha(a?.fecha ?? '');
    setInicio(a?.inicio ?? '');
    setFin(a?.fin ?? '');
    setReservaNombre(a?.reserva_nombre ?? '');
    setLugares(a?.lugares ?? '');
    setPersonas(a?.personas != null ? String(a.personas) : '');
    setTieneTickets(a?.tiene_tickets ?? false);
    setEntradas(
      (cargado.data?.entradas ?? []).map((e) => ({
        id: e.id,
        nombre: e.nombre ?? '',
        ticket: e.ticket ?? '',
        lugar: e.lugar ?? '',
        tarifa: e.tarifa != null ? String(e.tarifa) : '',
      })),
    );
    setInclusiones(a?.inclusiones ?? '');
    setTarifa(a?.tarifa != null ? String(a.tarifa) : '');
    setExtras(a?.extras ?? '');
    setMontoExtras(a?.monto_extras != null ? String(a.monto_extras) : '');
    setCancelacion(a?.cancelacion ?? '');
    setEstatusNota(a?.estatus_pago ?? '');
    setEstadoPago(a?.estado_pago ?? 'HOLD');
    setPagadoCon(a?.pagado_con ?? '');
    setPagadoConId(a?.pagado_con_id ?? null);
    setMoneda((a?.moneda as Currency) ?? 'USD');
    setError(null);
  }, [open, cargado.data]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!evento.trim()) return setError('El nombre del evento es obligatorio.');
    if (inicio && fin && fin < inicio) {
      return setError('La hora de fin no puede ser anterior a la de inicio.');
    }
    setError(null);

    const cabecera: AttActividadInsert = {
      viaje_id: viajeId,
      evento: evento.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      // La columna de texto se arma con los nombres de la lista: es la que
      // leen el PDF y cualquier vista que solo quiera saber quienes van.
      participantes: participantesConNombre.map((x) => x.nombre.trim()).filter(Boolean).join(', ') || null,
      reservado: reservado.trim() || null,
      confirmacion: confirmacion.trim() || null,
      descripcion: descripcion.trim() || null,
      duracion: duracion.trim() || null,
      fecha: fecha || null,
      inicio: inicio || null,
      fin: fin || null,
      reserva_nombre: reservaNombre.trim() || null,
      lugares: lugares.trim() || null,
      personas: personas.trim() === '' ? null : Number(personas),
      tiene_tickets: tieneTickets,
      inclusiones: inclusiones.trim() || null,
      tarifa: tarifa.trim() === '' ? null : Number(tarifa),
      extras: extras.trim() || null,
      monto_extras: montoExtras.trim() === '' ? null : Number(montoExtras),
      monto: total,
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusNota.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon.trim() || null,
      pagado_con_id: pagadoConId,
      moneda,
    };

    try {
      await save.mutateAsync({
        id: actividadId,
        cabecera,
        entradas: participantesConNombre,
      });
      toast.success(actividadId ? 'Actividad actualizada.' : 'Actividad agregada.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${actividadId ? 'Editar' : 'Nueva'} Actividad`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando actividad…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="El evento">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Evento *" value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Ej: Ópera en el Met" autoFocus />
              <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección completa" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Reserva a través de" value={reservado} onChange={(e) => setReservado(e.target.value)} placeholder="Agencia / plataforma" />
              <TextInput label="No. de confirmación" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="Código de confirmación" />
            </div>
            <TextArea label="Descripción del evento" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} />
          </Bloque>

          <Bloque titulo="Horario">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <TextInput label="Inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
              <TextInput label="Fin" type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
              <TextInput label="Duración" value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="Ej: 3 horas" />
            </div>
          </Bloque>

          <Bloque titulo="Participantes">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} placeholder="Nombre completo" />
              <TextInput label="Lugares" value={lugares} onChange={(e) => setLugares(e.target.value)} placeholder="Ej: Palco 3, fila A" />
              <TextInput label="Cantidad de personas" type="number" min="0" step="1" value={personas} onChange={(e) => setPersonas(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-dark-2">
              <input
                type="checkbox"
                checked={tieneTickets}
                onChange={(e) => setTieneTickets(e.target.checked)}
                className="h-4 w-4 rounded border-sand"
              />
              El evento tiene número de ticket
            </label>

            {/* Cada participante con su tarifa: las entradas de una misma
                función pueden ser de categorías distintas. El número de ticket
                y el lugar solo se piden si el evento los maneja. */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">
                Quiénes van
              </div>
              <p className="text-[11px] text-dark-3">
                Cada uno paga la tarifa por persona. Deja la tarifa en blanco para usarla,
                o escribe otra si esa persona paga distinto.
              </p>
              {entradas.length === 0 && (
                <p className="text-[11px] italic text-dark-3">
                  Sin participantes cargados. Mientras tanto el total usa la tarifa por
                  persona × la cantidad de personas.
                </p>
              )}
              {/* Encabezados: con los campos llenos, el placeholder ya no
                  dice cual es cual. */}
              {entradas.length > 0 && (
                <div className={`hidden gap-2 px-1 text-[10px] font-extrabold uppercase tracking-wider text-dark-3 sm:grid ${tieneTickets ? 'sm:grid-cols-[2fr_1.3fr_1.3fr_1fr_auto]' : 'sm:grid-cols-[3fr_1fr_auto]'}`}>
                  <span>Nombre</span>
                  {tieneTickets && <span>No. de ticket</span>}
                  {tieneTickets && <span>Lugar</span>}
                  <span>Tarifa ({moneda})</span>
                  <span className="w-[34px]" />
                </div>
              )}
              {entradas.map((x, i) => (
                <div
                  key={x.id ?? `nuevo-${i}`}
                  className={`grid grid-cols-1 gap-2 ${tieneTickets ? 'sm:grid-cols-[2fr_1.3fr_1.3fr_1fr_auto]' : 'sm:grid-cols-[3fr_1fr_auto]'}`}
                >
                  <input
                    type="text"
                    value={x.nombre}
                    onChange={(e) => setEntradas((l) => l.map((y, k) => (k === i ? { ...y, nombre: e.target.value } : y)))}
                    placeholder="Nombre del participante"
                    className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                  />
                  {tieneTickets && (
                    <input
                      type="text"
                      value={x.ticket}
                      onChange={(e) => setEntradas((l) => l.map((y, k) => (k === i ? { ...y, ticket: e.target.value } : y)))}
                      placeholder="No. de ticket"
                      className="block w-full rounded-md border border-sand bg-white px-3 py-2 font-mono text-sm text-dark placeholder:font-sans placeholder:text-dark-3 focus:border-teal focus:outline-none"
                    />
                  )}
                  {tieneTickets && (
                    <input
                      type="text"
                      value={x.lugar}
                      onChange={(e) => setEntradas((l) => l.map((y, k) => (k === i ? { ...y, lugar: e.target.value } : y)))}
                      placeholder="Lugar"
                      className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                    />
                  )}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={x.tarifa}
                    onChange={(e) => setEntradas((l) => l.map((y, k) => (k === i ? { ...y, tarifa: e.target.value } : y)))}
                    placeholder={tarifa ? Number(tarifa).toFixed(2) : `${moneda} 0.00`}
                    title="Vacío = paga la tarifa por persona del evento"
                    className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setEntradas((l) => l.filter((_, k) => k !== i))}
                    className="rounded-md border border-sand px-2 py-2 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
                    aria-label="Quitar participante"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                // La fila nace sin tarifa: vacia significa que paga la
                // tarifa por persona del evento.
                onClick={() => setEntradas((l) => [...l, { nombre: '', ticket: '', lugar: '', tarifa: '' }])}
                className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-80"
                style={{ borderColor: META.solid, color: META.dark }}
              >
                ＋ Agregar participante
              </button>
            </div>
          </Bloque>

          <Bloque titulo="Información de precio">
            <TextArea label="Inclusiones" value={inclusiones} onChange={(e) => setInclusiones(e.target.value)} rows={2} placeholder="Ej: Entrada, programa, copa de bienvenida…" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                {(['USD', 'GTQ', 'EUR', 'GBP'] as const).map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <TextInput label={`Tarifa por persona (${moneda})`} type="number" min="0" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} hint="La paga cada participante. En la lista se puede cambiar a quien pague distinto." />
              <TextInput label={`Monto extras (${moneda})`} type="number" min="0" step="0.01" value={montoExtras} onChange={(e) => setMontoExtras(e.target.value)} />
            </div>
            <TextInput label="Extras" value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="Descripción de extras" />
            <TextArea label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} rows={2} placeholder="Política de cancelación" />
          </Bloque>

          <div
            className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
            style={{ background: META.grad ?? META.dark }}
          >
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
                {META.icon} Total de la reserva
              </div>
              <div className="text-[11px] text-white/60">
                {participantesConNombre.length > 0
                  ? `${participantesConNombre.length} persona${participantesConNombre.length === 1 ? '' : 's'}`
                  : `${moneda} ${Number(tarifa || 0).toFixed(2)} × ${personas || 0} persona${personas === '1' ? '' : 's'}`}
                {Number(montoExtras) > 0 ? ' + extras' : ''}
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
            <PaymentMethodSelect
              label="Pagado con"
              value={pagadoCon}
              valueId={pagadoConId}
              onChange={(texto, tarjetaId) => {
                setPagadoCon(texto);
                setPagadoConId(tarjetaId);
              }}
            />
          </Bloque>

          <Bloque titulo="Confirmación">
            {actividadId ? (
              <ConfirmacionBoton id={actividadId} actual={cargado.data?.cabecera?.confirmacion_path} />
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda la actividad primero — el archivo se guarda bajo su número.
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
              {save.isPending ? 'Guardando…' : '💾 Guardar Actividad'}
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

function ConfirmacionBoton({ id, actual }: { id: string; actual?: string | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setSubiendo(true);
    try {
      await subirConfirmacionActividad(id, file);
      await qc.invalidateQueries({ queryKey: ['att_actividad_full', id] });
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
