import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { AirportPicker } from '../shared/AirportPicker';
import { PaymentMethodSelect } from '../shared/PaymentMethodSelect';
import { SERVICE_META } from '../constants/serviceMeta';
import { NationalityPicker } from '../shared/NationalityPicker';
import {
  CATEGORIAS,
  TIPOS_PAX,
  ESTATUS_PAGO,
  FORMAS_PAGO,
  TIPOS_TICKET,
  subirAdjuntoTicket,
  totalTicket,
  type AttTicketInsert,
  type TipoAdjunto,
  type EscalaInput,
  type PaxInput,
  type SegmentoInput,
} from './full-api';
import { useSaveTicketCompleto, useTicketCompleto } from './full-hooks';
import type { Database } from '@/types/database';

type Currency = Database['public']['Enums']['currency'];

type Props = {
  open: boolean;
  viajeId: string;
  /** undefined = nuevo ticket. */
  ticketId?: string;
  onClose: () => void;
};

const META = SERVICE_META.tickets;

const TIPO_PAX_DESC: Record<string, string> = {
  AD: 'Adulto',
  CHD: 'Niño',
  INF: 'Infante',
  SSA: 'Requiere asistencia especial',
};

const segmentoVacio = (direccion: string): SegmentoInput => ({
  direccion,
  ruta: '',
  origen_iata: '',
  origen_ciudad: '',
  destino_iata: '',
  destino_ciudad: '',
  fecha: '',
  fecha_llegada: '',
  etd: '',
  eta: '',
  numero_vuelo: '',
  tiempo_vuelo: '',
  pnrs: [],
  escalas: [],
});

const paxVacio = (): PaxInput => ({
  nombre: '',
  tipos: ['AD'],
  nacionalidades: [],
  pasaporte_num: '',
  libreta_num: '',
  visa_num: '',
  ffn: '',
  numero_ticket: '',
  asiento: '',
  eq_personal: '',
  eq_carryon: '',
  eq_documentado: '',
  tarifa: '',
  tarifa_nota: '',
  extras: '',
  extras_nota: '',
});

/**
 * Formulario del servicio Ticket Aéreo.
 *
 * Es un servicio DENTRO de un viaje del módulo T&T, no un módulo aparte: por
 * eso vive bajo `arriaza/` y recibe el `viajeId` del viaje que lo contiene.
 *
 * Todo se captura en una sola pasada — encabezado, ruta, pasajeros y pago — y
 * se guarda junto. El formulario anterior obligaba a guardar el ticket antes
 * de poder agregarle un pasajero.
 */
export function TicketFormModal({ open, viajeId, ticketId, onClose }: Props) {
  const cargado = useTicketCompleto(open ? ticketId : undefined);
  const save = useSaveTicketCompleto(viajeId);
  const toast = useToast();

  const [titulo, setTitulo] = useState('');
  const [aerolinea, setAerolinea] = useState('');
  const [reservadoPor, setReservadoPor] = useState('');
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
  const [pnrs, setPnrs] = useState<string[]>([]);
  const [pnrDraft, setPnrDraft] = useState('');
  const [tipoTicket, setTipoTicket] = useState<string>('OW');
  const [vueloDirecto, setVueloDirecto] = useState(true);
  const [numEscalas, setNumEscalas] = useState('');
  const [checkinIni, setCheckinIni] = useState('');
  const [checkinFin, setCheckinFin] = useState('');
  const [segmentos, setSegmentos] = useState<SegmentoInput[]>([]);
  const [pax, setPax] = useState<PaxInput[]>([]);
  const [estadoPago, setEstadoPago] = useState<string>('HOLD');
  const [estatusNota, setEstatusNota] = useState('');
  const [formasPago, setFormasPago] = useState<string[]>([]);
  const [penalidadDesc, setPenalidadDesc] = useState('');
  const [penalidadMonto, setPenalidadMonto] = useState('');
  const [pagadoCon, setPagadoCon] = useState('');
  const [pagadoConId, setPagadoConId] = useState<string | null>(null);
  const [fechaCargo, setFechaCargo] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = cargado.data;
    const t = d?.ticket;
    setTitulo(t?.titulo ?? '');
    setAerolinea(t?.aerolinea ?? '');
    setReservadoPor(t?.reservado_por ?? '');
    setCategoria(t?.categoria ?? CATEGORIAS[0]);
    setPnrs(d?.pnrs ?? (t?.codigo_reserva ? [t.codigo_reserva] : []));
    setTipoTicket(t?.tipo_ticket ?? 'OW');
    setVueloDirecto(t?.vuelo_directo ?? true);
    setNumEscalas(t?.num_escalas != null ? String(t.num_escalas) : '');
    setCheckinIni(t?.checkin_ini ?? '');
    setCheckinFin(t?.checkin_fin ?? '');
    setSegmentos(d?.segmentos.length ? d.segmentos : [segmentoVacio('ida')]);
    setPax(d?.pax.length ? d.pax : [paxVacio()]);
    setEstadoPago(t?.estado_pago ?? 'HOLD');
    setEstatusNota(t?.estatus_pago ?? '');
    setFormasPago(t?.formas_pago ?? []);
    setPenalidadDesc(t?.penalidad_desc ?? '');
    setPenalidadMonto(t?.penalidad_monto != null ? String(t.penalidad_monto) : '');
    setPagadoCon(t?.pagado_con ?? '');
    setPagadoConId(t?.pagado_con_id ?? null);
    setFechaCargo(t?.fecha_cargo ?? '');
    setMoneda((t?.moneda as Currency) ?? 'USD');
    setPnrDraft('');
    setError(null);
  }, [open, cargado.data]);

  const total = useMemo(() => totalTicket(pax), [pax]);
  const ida = segmentos.filter((s) => s.direccion !== 'retorno');
  const retorno = segmentos.filter((s) => s.direccion === 'retorno');

  function updSegmento(target: SegmentoInput, patch: Partial<SegmentoInput>) {
    setSegmentos((list) => list.map((s) => (s === target ? { ...s, ...patch } : s)));
  }
  function addSegmento(direccion: string) {
    setSegmentos((list) => [...list, segmentoVacio(direccion)]);
  }
  function removeSegmento(target: SegmentoInput) {
    setSegmentos((list) => list.filter((s) => s !== target));
  }
  function updPax(i: number, patch: Partial<PaxInput>) {
    setPax((list) => list.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!aerolinea.trim()) return setError('La línea aérea es obligatoria.');
    if (segmentos.length === 0) return setError('Agrega al menos un segmento de vuelo.');
    const sinRuta = segmentos.find((s) => !s.origen_iata || !s.destino_iata);
    if (sinRuta) return setError('Cada segmento necesita aeropuerto de origen y destino.');
    if (tipoTicket === 'RT' && retorno.length === 0) {
      return setError('Un ticket de ida y vuelta necesita al menos un segmento de retorno.');
    }
    const sinNombre = pax.find((p) => !p.nombre.trim());
    if (sinNombre) return setError('Cada pasajero necesita un nombre.');
    setError(null);

    const primero = ida[0] ?? segmentos[0];
    const ultimo = segmentos[segmentos.length - 1];
    const cabecera: AttTicketInsert = {
      viaje_id: viajeId,
      titulo: titulo.trim() || null,
      aerolinea: aerolinea.trim(),
      reservado_por: reservadoPor.trim() || null,
      categoria,
      tipo_ticket: tipoTicket,
      vuelo_directo: vueloDirecto,
      num_escalas: numEscalas.trim() === '' ? null : Number(numEscalas),
      checkin_ini: checkinIni || null,
      checkin_fin: checkinFin || null,
      estado_pago: estadoPago,
      estatus_pago: estatusNota.trim() || null,
      formas_pago: formasPago.length ? formasPago : null,
      penalidad_desc: penalidadDesc.trim() || null,
      penalidad_monto: penalidadMonto.trim() === '' ? null : Number(penalidadMonto),
      pagado_con: pagadoCon.trim() || null,
      pagado_con_id: pagadoConId,
      fecha_cargo: fechaCargo || null,
      moneda,
      // Espejo en el encabezado para que la fila del flyer y el itinerario no
      // tengan que abrir los segmentos.
      codigo_reserva: pnrs[0] ?? null,
      origen: primero?.origen_iata || null,
      destino: ultimo?.destino_iata || null,
      fecha_salida: primero?.fecha || null,
      fecha_llegada: ultimo?.fecha_llegada || ultimo?.fecha || null,
    };

    try {
      await save.mutateAsync({ ticketId, cabecera, pnrs, segmentos, pax });
      toast.success(ticketId ? 'Ticket actualizado.' : 'Ticket aéreo agregado.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${ticketId ? 'Editar' : 'Nuevo'} Ticket Aéreo`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando ticket…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Encabezado ──────────────────────────────────────────── */}
          <Bloque titulo="Encabezado">
            <TextInput
              label="Título *"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Vuelo GUA-MIA"
              autoFocus
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput
                label="Línea aérea *"
                value={aerolinea}
                onChange={(e) => setAerolinea(e.target.value)}
                placeholder="American Airlines"
              />
              <TextInput
                label="Reservado a través de"
                value={reservadoPor}
                onChange={(e) => setReservadoPor(e.target.value)}
                placeholder="Agencia / plataforma"
              />
              <Select label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <ListaChips
              label="PNR"
              placeholder="Código de reserva"
              draft={pnrDraft}
              onDraft={setPnrDraft}
              items={pnrs}
              onAdd={(v) => setPnrs((l) => (l.includes(v) ? l : [...l, v]))}
              onRemove={(i) => setPnrs((l) => l.filter((_, k) => k !== i))}
              mono
            />
          </Bloque>

          {/* ── Tipo de ticket y vuelo ──────────────────────────────── */}
          <Bloque titulo="Tipo de ticket">
            <div className="grid grid-cols-2 gap-3">
              {TIPOS_TICKET.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTipoTicket(t);
                    if (t === 'RT' && retorno.length === 0) addSegmento('retorno');
                  }}
                  className={`rounded-lg border-2 px-4 py-2 text-center transition-colors ${
                    tipoTicket === t
                      ? 'border-teal bg-teal-l text-teal-d'
                      : 'border-sand bg-white text-dark-2 hover:border-teal/40'
                  }`}
                >
                  <div className="text-sm font-extrabold">{t}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider">
                    {t === 'OW' ? 'Solo ida' : 'Ida y vuelta'}
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Select
                label="Tipo de vuelo"
                value={vueloDirecto ? 'directo' : 'escala'}
                onChange={(e) => setVueloDirecto(e.target.value === 'directo')}
              >
                <option value="directo">Directo</option>
                <option value="escala">Con escala</option>
              </Select>
              {!vueloDirecto && (
                <TextInput
                  label="No. de escalas"
                  type="number"
                  min="0"
                  value={numEscalas}
                  onChange={(e) => setNumEscalas(e.target.value)}
                />
              )}
              <TextInput
                label="Check-in inicio"
                type="time"
                value={checkinIni}
                onChange={(e) => setCheckinIni(e.target.value)}
              />
              <TextInput
                label="Check-in fin"
                type="time"
                value={checkinFin}
                onChange={(e) => setCheckinFin(e.target.value)}
              />
            </div>
          </Bloque>

          {/* ── Ruta ────────────────────────────────────────────────── */}
          <Bloque titulo={tipoTicket === 'RT' ? 'Ruta · Ida' : 'Ruta'}>
            {ida.map((s) => (
              <SegmentoCard
                key={segmentos.indexOf(s)}
                seg={s}
                onChange={(patch) => updSegmento(s, patch)}
                onRemove={ida.length > 1 ? () => removeSegmento(s) : undefined}
              />
            ))}
            <button
              type="button"
              onClick={() => addSegmento('ida')}
              className="rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l"
            >
              ＋ Agregar segmento
            </button>
          </Bloque>

          {tipoTicket === 'RT' && (
            <Bloque titulo="Ruta · Retorno">
              {retorno.map((s) => (
                <SegmentoCard
                  key={segmentos.indexOf(s)}
                  seg={s}
                  onChange={(patch) => updSegmento(s, patch)}
                  onRemove={retorno.length > 1 ? () => removeSegmento(s) : undefined}
                />
              ))}
              <button
                type="button"
                onClick={() => addSegmento('retorno')}
                className="rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l"
              >
                ＋ Agregar segmento
              </button>
            </Bloque>
          )}

          {/* ── Pasajeros ───────────────────────────────────────────── */}
          <Bloque titulo={`Pasajeros · ${pax.length}`}>
            {pax.map((p, i) => (
              <PaxCard
                key={i}
                idx={i}
                pax={p}
                moneda={moneda}
                onChange={(patch) => updPax(i, patch)}
                onRemove={pax.length > 1 ? () => setPax((l) => l.filter((_, k) => k !== i)) : undefined}
              />
            ))}
            <button
              type="button"
              onClick={() => setPax((l) => [...l, paxVacio()])}
              className="rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l"
            >
              ＋ Agregar PAX
            </button>
          </Bloque>

          {/* ── Total y pago ────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
            style={{ background: META.grad ?? META.dark }}
          >
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
                ✈ Total general del ticket
              </div>
              <div className="text-[11px] text-white/60">
                {pax.length} pasajero{pax.length === 1 ? '' : 's'} — suma de tarifa + extras
              </div>
            </div>
            <div className="font-heading text-2xl font-extrabold">
              {moneda} {total.toFixed(2)}
            </div>
          </div>

          <Bloque titulo="Pago">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <TextInput
                label="Penalidad por cambios"
                type="number"
                min="0"
                step="0.01"
                value={penalidadMonto}
                onChange={(e) => setPenalidadMonto(e.target.value)}
              />
            </div>
            <TextInput
              label="Estatus de pago"
              value={estatusNota}
              onChange={(e) => setEstatusNota(e.target.value)}
              placeholder="Ej: Depósito 50% pagado"
            />
            <TextInput
              label="Detalle de la penalidad"
              value={penalidadDesc}
              onChange={(e) => setPenalidadDesc(e.target.value)}
              placeholder="Condiciones del cambio"
            />
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
                Forma de pago
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {FORMAS_PAGO.map((f) => {
                  const activo = formasPago.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setFormasPago((l) => (activo ? l.filter((x) => x !== f) : [...l, f]))
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        activo
                          ? 'border-teal bg-teal text-white'
                          : 'border-sand bg-white text-dark-2 hover:border-teal/40'
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>
          </Bloque>

          {/* ── Adjuntos ────────────────────────────────────────────── */}
          <Bloque titulo="Documentos del ticket">
            {ticketId ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <AdjuntoBoton ticketId={ticketId} tipo="boleto" label="PDF del boleto" actual={cargado.data?.ticket?.pdf_boleto_path} />
                <AdjuntoBoton ticketId={ticketId} tipo="boarding" label="PDF del boarding pass" actual={cargado.data?.ticket?.pdf_boarding_path} />
                <AdjuntoBoton ticketId={ticketId} tipo="sat" label="PDF del SAT" actual={cargado.data?.ticket?.pdf_sat_path} />
              </div>
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda el ticket primero — los archivos se guardan bajo su número.
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
              disabled={save.isPending}
              className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-50"
            >
              {save.isPending ? 'Guardando…' : '💾 Finalizar carga de Ticket'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ── Piezas del formulario ─────────────────────────────────────────── */

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

function ListaChips({
  label, placeholder, draft, onDraft, items, onAdd, onRemove, mono,
}: {
  label: string;
  placeholder: string;
  draft: string;
  onDraft: (v: string) => void;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  mono?: boolean;
}) {
  function add() {
    const v = draft.trim().toUpperCase();
    if (!v) return;
    onAdd(v);
    onDraft('');
  }
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">{label}</div>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          // Se agrega también al salir del campo: escribir el PNR y guardar sin
          // presionar "Agregar" lo perdía en silencio.
          onBlur={add}
          placeholder={placeholder}
          className={`block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal ${mono ? 'font-mono' : ''}`}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-md border border-teal/40 px-3 py-2 text-xs font-semibold text-teal-d hover:bg-teal-l"
        >
          ＋ Agregar
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((v, i) => (
            <li
              key={`${v}-${i}`}
              className="inline-flex items-center gap-2 rounded-full bg-teal-l px-3 py-1 font-mono text-xs font-extrabold text-teal-d"
            >
              {v}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-teal-d/60 hover:text-rust"
                aria-label={`Quitar ${v}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SegmentoCard({
  seg, onChange, onRemove,
}: {
  seg: SegmentoInput;
  onChange: (patch: Partial<SegmentoInput>) => void;
  onRemove?: () => void;
}) {
  const [pnrDraft, setPnrDraft] = useState('');
  return (
    <div className="space-y-3 rounded-md border border-sand bg-sand-l/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <TextInput
          label="Ruta"
          value={seg.ruta}
          onChange={(e) => onChange({ ruta: e.target.value })}
          placeholder="Ej: GUA — MIA directo"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-5 shrink-0 rounded-md border border-sand px-2 py-2 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
            aria-label="Quitar segmento"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AirportPicker
          label="Origen (IATA)"
          value={seg.origen_iata}
          onChange={(code, a) => onChange({ origen_iata: code, origen_ciudad: a?.city ?? seg.origen_ciudad })}
        />
        <TextInput
          label="Ciudad de origen"
          value={seg.origen_ciudad}
          onChange={(e) => onChange({ origen_ciudad: e.target.value })}
        />
        <TextInput
          label="No. de vuelo"
          value={seg.numero_vuelo}
          onChange={(e) => onChange({ numero_vuelo: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AirportPicker
          label="Destino (IATA)"
          value={seg.destino_iata}
          onChange={(code, a) => onChange({ destino_iata: code, destino_ciudad: a?.city ?? seg.destino_ciudad })}
        />
        <TextInput
          label="Ciudad de destino"
          value={seg.destino_ciudad}
          onChange={(e) => onChange({ destino_ciudad: e.target.value })}
        />
        <div />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TextInput label="Fecha de salida" type="date" value={seg.fecha} onChange={(e) => onChange({ fecha: e.target.value })} />
        <TextInput label="ETD" type="time" value={seg.etd} onChange={(e) => onChange({ etd: e.target.value })} />
        <TextInput
          label="Fecha de llegada"
          type="date"
          value={seg.fecha_llegada}
          min={seg.fecha || undefined}
          onChange={(e) => onChange({ fecha_llegada: e.target.value })}
        />
        <TextInput label="ETA" type="time" value={seg.eta} onChange={(e) => onChange({ eta: e.target.value })} />
      </div>

      <TextInput
        label="Tiempo de vuelo"
        value={seg.tiempo_vuelo}
        onChange={(e) => onChange({ tiempo_vuelo: e.target.value })}
        placeholder="Ej: 2h 45m"
      />

      <ListaChips
        label="PNR del segmento (opcional)"
        placeholder="Código"
        draft={pnrDraft}
        onDraft={setPnrDraft}
        items={seg.pnrs}
        onAdd={(v) => onChange({ pnrs: seg.pnrs.includes(v) ? seg.pnrs : [...seg.pnrs, v] })}
        onRemove={(i) => onChange({ pnrs: seg.pnrs.filter((_, k) => k !== i) })}
        mono
      />

      {/* Escalas del segmento */}
      <div className="rounded-md border border-dashed border-sand p-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-dark-3">Escalas</div>
        {seg.escalas.map((e, i) => (
          <div key={i} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <AirportPicker
              value={e.iata}
              onChange={(code, a) =>
                onChange({
                  escalas: seg.escalas.map((x, k) =>
                    k === i ? { ...x, iata: code, ciudad: a?.city ?? x.ciudad } : x,
                  ),
                })
              }
              placeholder="Escala (IATA)…"
            />
            <input
              type="text"
              value={e.ciudad}
              onChange={(ev) =>
                onChange({
                  escalas: seg.escalas.map((x, k) => (k === i ? { ...x, ciudad: ev.target.value } : x)),
                })
              }
              placeholder="Ciudad de escala"
              className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
            />
            <input
              type="text"
              value={e.tiempo}
              onChange={(ev) =>
                onChange({
                  escalas: seg.escalas.map((x, k) => (k === i ? { ...x, tiempo: ev.target.value } : x)),
                })
              }
              placeholder="Tiempo de escala"
              className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onChange({ escalas: seg.escalas.filter((_, k) => k !== i) })}
              className="mt-1 rounded-md border border-sand px-2 py-2 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
              aria-label="Quitar escala"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({ escalas: [...seg.escalas, { iata: '', ciudad: '', tiempo: '' } as EscalaInput] })
          }
          className="mt-2 rounded-md border border-teal/40 px-2 py-1 text-[11px] font-semibold text-teal-d hover:bg-teal-l"
        >
          ＋ Escala
        </button>
      </div>
    </div>
  );
}

function PaxCard({
  idx, pax, moneda, onChange, onRemove,
}: {
  idx: number;
  pax: PaxInput;
  moneda: string;
  onChange: (patch: Partial<PaxInput>) => void;
  onRemove?: () => void;
}) {
  const totalPax = (Number(pax.tarifa) || 0) + (Number(pax.extras) || 0);
  return (
    <div className="space-y-3 rounded-md border border-sand bg-sand-l/40 p-3">
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white"
          style={{ backgroundColor: META.dark }}
        >
          Pax {idx + 1}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-sand px-2 py-1 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
            aria-label="Quitar pasajero"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <TextInput label="Nombre *" value={pax.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-dark-2">Tipo</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {TIPOS_PAX.map((t) => {
              const activo = pax.tipos.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  title={TIPO_PAX_DESC[t]}
                  onClick={() =>
                    onChange({
                      tipos: activo ? pax.tipos.filter((x) => x !== t) : [...pax.tipos, t],
                    })
                  }
                  className={`rounded-md border px-2 py-1 text-[11px] font-extrabold transition-colors ${
                    activo
                      ? 'border-teal bg-teal text-white'
                      : 'border-sand bg-white text-dark-2 hover:border-teal/40'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <NationalityPicker
          label="Nacionalidad(es)"
          value={pax.nacionalidades}
          onChange={(codes) => onChange({ nacionalidades: codes })}
        />
        <TextInput label="No. de pasaporte" value={pax.pasaporte_num} onChange={(e) => onChange({ pasaporte_num: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput label="No. de libreta" value={pax.libreta_num} onChange={(e) => onChange({ libreta_num: e.target.value })} />
        <TextInput label="No. de visa" value={pax.visa_num} onChange={(e) => onChange({ visa_num: e.target.value })} />
        <TextInput label="Frequent flyer" value={pax.ffn} onChange={(e) => onChange({ ffn: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput label="No. de ticket" value={pax.numero_ticket} onChange={(e) => onChange({ numero_ticket: e.target.value })} />
        <TextInput label="Asiento" value={pax.asiento} onChange={(e) => onChange({ asiento: e.target.value })} />
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-dark-3">Equipaje</div>
        <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextInput label="Artículo personal" value={pax.eq_personal} onChange={(e) => onChange({ eq_personal: e.target.value })} />
          <TextInput label="Carry on" value={pax.eq_carryon} onChange={(e) => onChange({ eq_carryon: e.target.value })} />
          <TextInput label="Equipaje documentado" value={pax.eq_documentado} onChange={(e) => onChange({ eq_documentado: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-2">
          <TextInput label={`Tarifa (${moneda})`} type="number" min="0" step="0.01" value={pax.tarifa} onChange={(e) => onChange({ tarifa: e.target.value })} />
          <TextInput label="Comentario" value={pax.tarifa_nota} onChange={(e) => onChange({ tarifa_nota: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextInput label={`Extras (${moneda})`} type="number" min="0" step="0.01" value={pax.extras} onChange={(e) => onChange({ extras: e.target.value })} />
          <TextInput label="Comentario" value={pax.extras_nota} onChange={(e) => onChange({ extras_nota: e.target.value })} />
        </div>
      </div>

      <div className="rounded-md bg-teal-l px-3 py-2 text-right text-xs font-extrabold text-teal-d">
        Total por pax: {moneda} {totalPax.toFixed(2)}
      </div>
    </div>
  );
}


/**
 * Sube uno de los tres PDF del ticket. Los archivos van al bucket exclusivo de
 * T&T, nunca al de Finanzas.
 */
function AdjuntoBoton({
  ticketId, tipo, label, actual,
}: {
  ticketId: string;
  tipo: TipoAdjunto;
  label: string;
  actual?: string | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setSubiendo(true);
    try {
      await subirAdjuntoTicket(ticketId, tipo, file);
      await qc.invalidateQueries({ queryKey: ['att_ticket_full', ticketId] });
      toast.success(`${label} cargado.`);
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
        className="w-full rounded-md border border-dashed border-teal/50 bg-teal-l/40 px-3 py-3 text-xs font-semibold text-teal-d hover:bg-teal-l disabled:opacity-60"
      >
        {subiendo ? 'Subiendo…' : `📎 ${label}`}
        <span className="mt-0.5 block text-[10px] font-normal text-dark-3">
          {actual ? 'Cargado — subir otro lo reemplaza' : 'Sin archivo'}
        </span>
      </button>
    </div>
  );
}
