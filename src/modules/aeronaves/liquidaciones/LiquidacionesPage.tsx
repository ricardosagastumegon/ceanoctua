import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { puede, useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { parseNumero } from '@/lib/money';
import { ESTADOS, ESTADO_COLOR, type LiquidacionFila } from './api';
import {
  useAeronavesSimples, useBorrarLiquidacion, useCrearLiquidacion,
  useLiquidaciones, usePilotosActivos,
} from './hooks';
import { LiquidacionDetalle } from './LiquidacionDetalle';

function q(n: number | null | undefined): string {
  return `Q ${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Liquidación del piloto.
 *
 * Arriba el resumen de lo que hay; abajo la lista. Lo que se busca al entrar
 * es casi siempre una sola cosa --cuánto se le debe a los pilotos-- así que
 * ese número va primero y aparte.
 */
export function LiquidacionesPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const q1 = useLiquidaciones();
  const borrar = useBorrarLiquidacion();

  const [nueva, setNueva] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>('');
  const [busca, setBusca] = useState('');

  const canEdit = puede(profile, 'aeronaves', 'editor') || puede(profile, 'avn_liquidacion', 'editor');
  const esAdmin = profile?.rol === 'admin';

  const todas = useMemo(() => q1.data ?? [], [q1.data]);

  const resumen = useMemo(() => {
    const anio = new Date().getFullYear();
    const delAnio = todas.filter((l) => new Date(l.fecha_inicio).getFullYear() === anio);
    const porReembolsar = todas.filter((l) => l.estado !== 'Reembolsada');
    return {
      total: todas.length,
      borradores: todas.filter((l) => l.estado === 'Borrador').length,
      gastoAnio: delAnio.reduce((t, l) => t + Number(l.total_gtq), 0),
      viajesAnio: delAnio.length,
      reembolso: porReembolsar.reduce((t, l) => t + Number(l.piloto_gtq), 0),
      reembolsoN: porReembolsar.filter((l) => Number(l.piloto_gtq) > 0).length,
    };
  }, [todas]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return todas.filter((l) => {
      if (filtro && l.estado !== filtro) return false;
      if (!t) return true;
      return [l.serial, l.piloto, l.matricula, l.ruta, l.motivo]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(t));
    });
  }, [todas, filtro, busca]);

  const detalle = useMemo(
    () => todas.find((l) => l.id === abierta) ?? null,
    [todas, abierta],
  );

  async function quitar(l: LiquidacionFila) {
    const ok = await confirmar({
      title: 'Borrar liquidación',
      message: <>¿Borrar <b>{l.serial}</b>? Se puede recuperar desde la auditoría, pero deja de verse aquí.</>,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(l.id);
      toast.success('Liquidación borrada.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="space-y-5">

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-teal-d">Liquidación del piloto</h1>
          <p className="mt-0.5 text-sm text-dark-3">
            Los gastos de cada viaje, y lo que hay que reembolsarle al piloto.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setNueva(true)}
            className="rounded-md bg-teal px-4 py-2.5 text-sm font-extrabold text-white hover:bg-teal-d">
            ＋ Liquidación
          </button>
        )}
      </div>

      {/* El resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-card border-2 border-rust bg-rust-l p-4">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-rust">Por reembolsar a pilotos</div>
          <div className="mt-1 text-2xl font-extrabold text-rust">{q(resumen.reembolso)}</div>
          <div className="text-[11px] text-rust">
            {resumen.reembolsoN === 0 ? 'nada pendiente' : `en ${resumen.reembolsoN} liquidaciones`}
          </div>
        </div>
        <div className="rounded-card border border-sand bg-white p-4">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">Gasto de viajes {new Date().getFullYear()}</div>
          <div className="mt-1 text-2xl font-extrabold text-dark">{q(resumen.gastoAnio)}</div>
          <div className="text-[11px] text-dark-3">{resumen.viajesAnio} viajes</div>
        </div>
        <div className="rounded-card border border-sand bg-white p-4">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">En borrador</div>
          <div className="mt-1 text-2xl font-extrabold text-dark">{resumen.borradores}</div>
          <div className="text-[11px] text-dark-3">sin cerrar</div>
        </div>
        <div className="rounded-card border border-sand bg-white p-4">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">Liquidaciones</div>
          <div className="mt-1 text-2xl font-extrabold text-dark">{resumen.total}</div>
          <div className="text-[11px] text-dark-3">en total</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <TextInput value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por correlativo, piloto, matrícula o ruta…" className="min-w-[240px] flex-1" />
        <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-auto">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
      </div>

      {/* La lista */}
      {q1.isLoading && <p className="text-sm text-dark-3">Cargando…</p>}

      {!q1.isLoading && todas.length === 0 && (
        <div className="rounded-card border border-dashed border-sand bg-sand-l px-4 py-10 text-center">
          <p className="text-sm font-semibold text-dark-2">Todavía no hay ninguna liquidación.</p>
          <p className="mt-1 text-xs text-dark-3">
            Creá una al salir de viaje y andá cargándole los gastos conforme se vayan dando.
          </p>
        </div>
      )}

      {!q1.isLoading && todas.length > 0 && lista.length === 0 && (
        <p className="rounded-card border border-dashed border-sand bg-sand-l px-4 py-6 text-center text-sm text-dark-3">
          Ninguna liquidación coincide con lo que buscás.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {lista.map((l) => (
          <button key={l.id} type="button" onClick={() => setAbierta(l.id)}
            className="rounded-card border border-sand bg-white p-4 text-left shadow-sm transition hover:border-teal hover:shadow">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-sm font-extrabold text-dark">{l.serial ?? '—'}</div>
                <div className="mt-0.5 truncate text-sm font-semibold text-teal-d">
                  {l.matricula ?? '—'} · {l.ruta || 'sin ruta'}
                </div>
              </div>
              <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${ESTADO_COLOR[l.estado] ?? 'bg-sand'}`}>
                {l.estado}
              </span>
            </div>

            <div className="mt-1 text-[11px] text-dark-3">
              {formatDate(l.fecha_inicio)} — {formatDate(l.fecha_fin)} · Piloto {l.piloto ?? '—'} · {l.gastos} gastos
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-sand pt-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-dark-3">Total del viaje</div>
                <div className="text-sm font-extrabold text-dark">{q(l.total_gtq)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-rust">A reembolsar</div>
                <div className="text-sm font-extrabold text-rust">{q(l.piloto_gtq)}</div>
              </div>
              {esAdmin && (
                <span role="button" tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); void quitar(l); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void quitar(l); } }}
                  title="Borrar" className="px-1 text-xs opacity-40 hover:opacity-100">🗑</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {nueva && <NuevaLiquidacion onClose={() => setNueva(false)} onCreada={(id) => setAbierta(id)} />}

      {detalle && (
        <LiquidacionDetalle liquidacion={detalle} canEdit={canEdit} onClose={() => setAbierta(null)} />
      )}
    </div>
  );
}

function NuevaLiquidacion({ onClose, onCreada }: { onClose: () => void; onCreada: (id: string) => void }) {
  const toast = useToast();
  const crear = useCrearLiquidacion();
  const pilotos = usePilotosActivos();
  const aeronaves = useAeronavesSimples();

  const [aeronaveId, setAeronaveId] = useState('');
  const [pilotoId, setPilotoId] = useState('');
  const [ruta, setRuta] = useState('');
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fin, setFin] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const [pasajeros, setPasajeros] = useState('');
  const [tcQ, setTcQ] = useState('7.5300');
  const [tcD, setTcD] = useState('7.9100');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function submit() {
    if (!aeronaveId) return setError('Elegí la aeronave.');
    if (!pilotoId) return setError('Elegí el piloto.');
    if (!inicio || !fin) return setError('Faltan las fechas del viaje.');
    if (fin < inicio) return setError('La fecha de regreso no puede ser antes de la de salida.');
    setError(null);
    setGuardando(true);
    try {
      const l = await crear.mutateAsync({
        aeronave_id: aeronaveId,
        piloto_id: pilotoId,
        ruta: ruta.trim() || null,
        fecha_inicio: inicio,
        fecha_fin: fin,
        motivo: motivo.trim() || null,
        pasajeros: pasajeros.trim() || null,
        tc_gtq_usd: parseNumero(tcQ),
        tc_usd_gtq: parseNumero(tcD),
      });
      toast.success(`${l.serial} creada. Ya podés cargarle gastos.`);
      onClose();
      onCreada(l.id);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nueva liquidación de viaje" size="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Aeronave" value={aeronaveId} onChange={(e) => setAeronaveId(e.target.value)}>
            <option value="">Elegí…</option>
            {(aeronaves.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.matricula}</option>
            ))}
          </Select>
          <Select label="Piloto" value={pilotoId} onChange={(e) => setPilotoId(e.target.value)}
            hint="salen del catálogo de pilotos de Aeronaves">
            <option value="">Elegí…</option>
            {(pilotos.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (inactivo)'}</option>
            ))}
          </Select>
        </div>

        <TextInput label="Ruta" value={ruta} onChange={(e) => setRuta(e.target.value)}
          placeholder="GUA → FRS → EYW → MIA" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput label="Salida" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <TextInput label="Regreso" type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>

        <TextInput label="Motivo del viaje" value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Reposicionamiento de aeronave para servicio annual" />
        <TextInput label="Pasajeros" value={pasajeros} onChange={(e) => setPasajeros(e.target.value)}
          placeholder="Ninguno" />

        <div className="rounded-md border border-sand bg-sand-l p-3">
          <p className="mb-2 text-[11px] text-dark-3">
            Los tipos de cambio del viaje. Se le proponen a cada gasto según su moneda, y
            cada gasto guarda el suyo: así quedan declarados en vez de deducirse dividiendo.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput label="Quetzales → dólar" value={tcQ} onChange={(e) => setTcQ(e.target.value)} inputMode="decimal" />
            <TextInput label="Dólares → quetzal" value={tcD} onChange={(e) => setTcD(e.target.value)} inputMode="decimal" />
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="button" onClick={() => void submit()} disabled={guardando}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-60">
            {guardando ? 'Creando…' : 'Crear liquidación'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default LiquidacionesPage;
