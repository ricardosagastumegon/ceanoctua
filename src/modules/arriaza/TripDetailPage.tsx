import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { ManualStatusSelect } from './shared/ManualStatusSelect';
import { TripServicesPanel } from './TripServicesPanel';
import { TripFormModal, type TripDestinos } from './TripFormModal';
import { ItineraryModal } from './ItineraryModal';
import { ShareModal } from './ShareModal';
import { autoTripStatus, autoStatusLabel, fmtDate } from './utils';
import { useAttViaje, useDeleteAttViaje, useUpdateAttViaje } from './viajes/hooks';
import { useSyncViajeDestinos, useViajeDestinos } from './viajes/destinos-hooks';
import { useServiceSummary } from './viajes/service-counts';
import type { AttViajeInsert } from './viajes/api';
import { SERVICE_META, type ManualStatus, type ServiceKey } from './constants/serviceMeta';

const AUTO_BADGE: Record<ReturnType<typeof autoTripStatus>, string> = {
  proximo: 'bg-gold-light text-gold',
  curso: 'bg-teal-l text-teal-d',
  finalizado: 'bg-sand-l text-dark-3',
};

/**
 * Pantalla propia del viaje.
 *
 * El documento del dashboard lo pide así: al hacer clic en un viaje se abre
 * una pantalla aparte para seguir construyéndolo, con un botón para regresar.
 * Antes los servicios se desplegaban dentro de la tarjeta del dashboard, lo
 * que mezclaba "ver la lista de viajes" con "armar este viaje".
 *
 * La URL lleva el uuid y no el correlativo: el correlativo puede venir nulo en
 * viajes viejos y su formato puede cambiar.
 */
export function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';

  const viajeQuery = useAttViaje(id);
  const destinos = useViajeDestinos(id);
  const resumen = useServiceSummary(id, true);
  const update = useUpdateAttViaje();
  const remove = useDeleteAttViaje();
  const syncDestinos = useSyncViajeDestinos();
  const toast = useToast();
  const confirm = useConfirm();

  const [editOpen, setEditOpen] = useState(false);
  const [itinOpen, setItinOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const viaje = viajeQuery.data;

  if (viajeQuery.isLoading) {
    return <p className="p-6 text-sm text-dark-3">Cargando viaje…</p>;
  }
  if (!viaje) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-dark-2">Este viaje no existe o fue borrado.</p>
        <Link to="/arriaza" className="text-sm font-extrabold text-teal-d hover:underline">
          ← Regresar a los viajes
        </Link>
      </div>
    );
  }

  const auto = autoTripStatus(viaje);
  const manualStatus = (viaje.manual_status ?? 'Solicitado') as ManualStatus;
  const paises = destinos.data?.paises ?? [];
  const ciudades = destinos.data?.ciudades ?? [];
  const paradas = destinos.data?.paradas ?? [];

  async function handleSave(values: AttViajeInsert, nuevos: TripDestinos) {
    if (!viaje) return;
    try {
      await update.mutateAsync({ id: viaje.id, patch: values });
      await syncDestinos.mutateAsync({ viajeId: viaje.id, ...nuevos });
      toast.success('Viaje actualizado.');
      setEditOpen(false);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleStatus(status: ManualStatus) {
    if (!viaje) return;
    try {
      await update.mutateAsync({ id: viaje.id, patch: { manual_status: status } });
      if (status === 'Finalizado') toast.success('🎉 Viaje movido a Viajes Realizados');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleDelete() {
    if (!viaje) return;
    const ok = await confirm({
      title: 'Borrar viaje',
      message: <>¿Borrar <strong>{viaje.titulo}</strong> y todas sus reservas?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(viaje.id);
      toast.success('Viaje borrado.');
      navigate('/arriaza');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <section className="space-y-4">
      {/* Regresar · lo primero de la pantalla, como pide el documento. */}
      <Link
        to="/arriaza"
        className="inline-flex items-center gap-1 text-sm font-extrabold text-teal-d hover:underline"
      >
        ← Regresar a los viajes
      </Link>

      {/* Encabezado del viaje */}
      <div className="rounded-card border-b-4 border-gold bg-gradient-to-r from-navy via-teal-d to-aqua px-6 py-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {paises[0] && (
                <span className="rounded bg-white/20 px-2 py-0.5 font-mono text-[11px] font-extrabold">
                  {paises[0].codigo}
                </span>
              )}
              {viaje.trip_no && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[11px] font-extrabold">
                  {viaje.trip_no}
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${AUTO_BADGE[auto]}`}>
                {autoStatusLabel(auto)}
              </span>
            </div>
            <h1 className="mt-1 font-heading text-2xl font-extrabold">{viaje.titulo}</h1>
            <div className="mt-1 text-sm font-semibold text-white/80">
              📅 {fmtDate(viaje.fecha_ini)} — {fmtDate(viaje.fecha_fin)}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {resumen.data && resumen.data.total > 0 && (
              <div className="text-right">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">
                  Costo total{resumen.data.totalParcial ? ' · parcial' : ''}
                </div>
                <div className="font-heading text-2xl font-extrabold">
                  {resumen.data.monedas.length === 1 ? `${resumen.data.monedas[0]} ` : ''}
                  {resumen.data.total.toFixed(2)}
                </div>
                {resumen.data.monedas.length > 1 && (
                  <div className="text-[10px] font-semibold text-white/70">
                    ⚠ mezcla {resumen.data.monedas.join(' · ')}
                  </div>
                )}
              </div>
            )}
            {canEdit && <ManualStatusSelect value={manualStatus} onChange={handleStatus} />}
            <div className="flex flex-wrap gap-1">
              <BotonHeader onClick={() => setItinOpen(true)} title="Itinerario final">📋</BotonHeader>
              <BotonHeader onClick={() => setShareOpen(true)} title="Compartir por WhatsApp">📲</BotonHeader>
              {canEdit && (
                <>
                  <BotonHeader onClick={() => setEditOpen(true)} title="Editar viaje">✏️</BotonHeader>
                  <BotonHeader onClick={() => void handleDelete()} title="Eliminar viaje">🗑</BotonHeader>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Datos del viaje */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-card border border-sand bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="font-heading text-base font-extrabold text-dark">Datos del viaje</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Dato label="Países de destino">
              {paises.length === 0 ? '—' : (
                <span className="flex flex-wrap gap-1">
                  {paises.map((p) => (
                    <span key={p.id} className="rounded-full bg-teal-l px-2 py-0.5 text-xs font-semibold text-teal-d">
                      <span className="font-mono">{p.codigo}</span> {p.nombre}
                    </span>
                  ))}
                </span>
              )}
            </Dato>
            <Dato label="Ciudades destino">
              {ciudades.length === 0 ? '—' : (
                <span className="flex flex-wrap gap-1">
                  {ciudades.map((c) => (
                    <span key={c.id} className="rounded-full bg-sand-l px-2 py-0.5 text-xs font-semibold text-dark-2">
                      {c.nombre}
                    </span>
                  ))}
                </span>
              )}
            </Dato>
            <Dato label="Participantes">{viaje.acompanantes ?? '—'}</Dato>
            <Dato label="Motivo del viaje">
              {viaje.proposito === 'Otros' && viaje.other_reason
                ? `Otros · ${viaje.other_reason}`
                : viaje.proposito ?? '—'}
            </Dato>
            <Dato label="Pagado por">{viaje.paidby ?? '—'}</Dato>
            <Dato label="Notas">{viaje.notas ?? '—'}</Dato>
          </div>

          {paradas.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">
                Paradas
              </div>
              <ul className="mt-1 space-y-1">
                {paradas.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline gap-2 rounded-md bg-sand-l px-2 py-1 text-xs">
                    <span className="font-extrabold text-dark-2">{p.nombre}</span>
                    <span className="text-dark-3">
                      {p.fecha_ini ? fmtDate(p.fecha_ini) : '—'}
                      {p.fecha_fin ? ` — ${fmtDate(p.fecha_fin)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Desglose del costo por servicio */}
        <div className="rounded-card border border-sand bg-white p-4 shadow-sm">
          <h2 className="font-heading text-base font-extrabold text-dark">Costo por servicio</h2>
          {!resumen.data || Object.keys(resumen.data.montos).length === 0 ? (
            <p className="mt-2 text-xs italic text-dark-3">Todavía no hay servicios con monto.</p>
          ) : (
            <>
              <ul className="mt-2 space-y-1">
                {(Object.entries(resumen.data.montos) as [ServiceKey, number][]).map(([key, monto]) => {
                  const meta = SERVICE_META[key];
                  return (
                    <li key={key} className="flex justify-between border-b border-sand py-1 text-xs">
                      <span className="text-dark-2">
                        {meta.icon} {meta.label}
                        {resumen.data.counts[key] ? ` · ${resumen.data.counts[key]}` : ''}
                      </span>
                      <span className="font-extrabold" style={{ color: meta.dark }}>
                        {Number(monto).toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {resumen.data.monedas.length > 1 && (
                <p className="mt-2 rounded-md bg-gold-light px-2 py-1 text-[11px] font-semibold text-gold">
                  ⚠ Hay servicios en {resumen.data.monedas.join(', ')}. El total los suma sin
                  convertir, así que tómalo como referencia.
                </p>
              )}
              {resumen.data.totalParcial && (
                <p className="mt-2 text-[11px] italic text-dark-3">
                  Hay servicios que todavía no registran monto, así que el total es parcial.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <TripServicesPanel viaje={viaje} canEdit={canEdit} />

      <TripFormModal
        open={editOpen}
        editing={viaje}
        submitting={update.isPending || syncDestinos.isPending}
        onClose={() => setEditOpen(false)}
        onSubmit={handleSave}
      />
      <ItineraryModal open={itinOpen} onClose={() => setItinOpen(false)} viaje={viaje} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} viaje={viaje} />
    </section>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">{label}</div>
      <div className="mt-0.5 text-sm text-dark-2">{children}</div>
    </div>
  );
}

function BotonHeader({
  onClick, title, children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-md border border-white/30 bg-white/15 px-2 py-1 text-sm hover:bg-white/25"
    >
      {children}
    </button>
  );
}
