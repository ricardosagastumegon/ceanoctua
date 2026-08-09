import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { describeError } from '@/modules/admin/hooks';
import { slug } from './utils';

// Backup Modal · export a JSON + import desde JSON (formato standalone HTML).
//
// Export: agarra TODAS las tablas att_* (viajes + hijos + nietos) y las serializa
// en un JSON con la misma estructura del state.ttTrips del HTML standalone.
// Útil para transferir data entre instancias o hacer un respaldo local.
//
// Import: parsea un JSON del HTML standalone y lo inserta en las tablas
// att_* respectivas. Los INSERTs se hacen viaje por viaje, con cascade a
// hijos/nietos. Los IDs se re-generan (no se preservan del backup) para
// evitar colisiones. Los `tripNo` sí se preservan cuando existen.

type Props = { open: boolean; onClose: () => void };

// ============================================================
// EXPORT
// ============================================================
type ExportedTrip = Record<string, unknown>;

async function fetchAll<T>(table: string): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = supabase;
  const { data, error } = await c.from(table).select('*').is('deleted_at', null);
  if (error) throw error;
  return (data ?? []) as T[];
}

async function buildExport(): Promise<{ generated_at: string; source: string; trips: ExportedTrip[] }> {
  const viajes = await fetchAll<Record<string, unknown> & { id: string }>('att_viajes');
  const tables = [
    'att_tickets', 'att_hoteles', 'att_hotel_habitaciones', 'att_restaurantes',
    'att_rentas', 'att_tours', 'att_aeronaves', 'att_acuaticos', 'att_ferries',
    'att_terrestres', 'att_tiendas', 'att_actividades', 'att_actividad_tickets',
    'att_actividad_subtickets', 'att_reuniones', 'att_rutas', 'att_pois',
    'att_day_plans', 'att_day_plan_rows', 'att_day_notes',
  ] as const;
  const allChildren: Record<string, Record<string, unknown>[]> = {};
  for (const t of tables) {
    allChildren[t] = await fetchAll<Record<string, unknown>>(t);
  }

  const trips: ExportedTrip[] = viajes.map((v) => {
    const tid = v.id;
    return {
      ...v,
      _children: Object.fromEntries(
        tables.map((t) => {
          const parentKey = t === 'att_hotel_habitaciones'
            ? 'hotel_id'
            : t === 'att_actividad_tickets'
              ? 'actividad_id'
              : t === 'att_actividad_subtickets'
                ? 'ticket_id'
                : t === 'att_day_plan_rows'
                  ? 'day_plan_id'
                  : 'viaje_id';
          if (parentKey === 'viaje_id') {
            return [t, allChildren[t].filter((r) => r.viaje_id === tid)];
          }
          // Para nietos, filtrar por sus abuelos (viaje_id via parent lookup).
          // Simplificación: los nietos ya están indirectamente ligados al viaje
          // vía sus padres. Los devolvemos todos para el trip que su padre
          // pertenezca (lookup en cliente por simplicidad).
          if (t === 'att_hotel_habitaciones') {
            const hotelIds = new Set(allChildren['att_hoteles'].filter((h) => h.viaje_id === tid).map((h) => h.id));
            return [t, allChildren[t].filter((r) => hotelIds.has(r.hotel_id as string))];
          }
          if (t === 'att_actividad_tickets') {
            const actIds = new Set(allChildren['att_actividades'].filter((a) => a.viaje_id === tid).map((a) => a.id));
            return [t, allChildren[t].filter((r) => actIds.has(r.actividad_id as string))];
          }
          if (t === 'att_actividad_subtickets') {
            const actIds = new Set(allChildren['att_actividades'].filter((a) => a.viaje_id === tid).map((a) => a.id));
            const ticketIds = new Set(
              allChildren['att_actividad_tickets']
                .filter((tk) => actIds.has(tk.actividad_id as string))
                .map((tk) => tk.id),
            );
            return [t, allChildren[t].filter((r) => ticketIds.has(r.ticket_id as string))];
          }
          if (t === 'att_day_plan_rows') {
            const dpIds = new Set(allChildren['att_day_plans'].filter((d) => d.viaje_id === tid).map((d) => d.id));
            return [t, allChildren[t].filter((r) => dpIds.has(r.day_plan_id as string))];
          }
          return [t, []];
        }),
      ),
    };
  });

  return { generated_at: new Date().toISOString(), source: 'CEA NOCTUA · Arriaza T&T', trips };
}

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// IMPORT
// ============================================================
type StandaloneTrip = {
  id?: string;
  tripNo?: string;
  title?: string;
  start?: string;
  end?: string;
  country?: string;
  dest?: string;
  participants?: string;
  reason?: string;
  manualStatus?: string;
  tickets?: unknown[];
  hotels?: unknown[];
  restaurantes?: unknown[];
  rentas?: unknown[];
  tours?: unknown[];
  aeronaves?: unknown[];
  acuaticos?: unknown[];
  ferries?: unknown[];
  terrestres?: unknown[];
  actividades?: unknown[];
  tiendas?: unknown[];
  reuniones?: unknown[];
  rutas?: unknown[];
  pois?: unknown[];
  dayPlans?: unknown[];
  dayNotes?: unknown[];
};

async function importTrip(t: StandaloneTrip): Promise<{ tripNo: string | null; ok: boolean; msg: string }> {
  // Mapear campos del HTML → columnas CEA (att_viajes).
  const insertViaje = {
    titulo: t.title ?? 'Viaje importado',
    trip_no: t.tripNo ?? null,
    fecha_ini: t.start ?? null,
    fecha_fin: t.end ?? null,
    pais: t.country ?? null,
    destino: t.dest ?? null,
    acompanantes: t.participants ?? null,
    proposito: t.reason ?? null,
    manual_status: (t.manualStatus ?? 'Solicitado') as 'Solicitado' | 'En planeación' | 'En curso' | 'Finalizado',
    estado: 'planificado' as const,
  };
  const { data: viaje, error } = await supabase
    .from('att_viajes')
    .insert(insertViaje)
    .select('id, trip_no')
    .single();
  if (error || !viaje) return { tripNo: t.tripNo ?? null, ok: false, msg: error?.message ?? 'sin data' };

  // TODO Full mapping: por cada tipo de servicio en el standalone,
  // insertar en la tabla correspondiente. Este MVP importa solo el
  // viaje (metadatos). El mapping completo por servicio se hace en
  // una fase futura porque cada servicio tiene ~30 campos con nombres
  // ligeramente distintos entre el HTML y CEA.
  return { tripNo: viaje.trip_no, ok: true, msg: 'viaje importado (servicios pendientes de mapping completo)' };
}

export function BackupModal({ open, onClose }: Props) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await buildExport();
      downloadJson(`att_backup_${new Date().toISOString().slice(0, 10)}.json`, data);
      toast.success(`Exportados ${data.trips.length} viajes.`);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(file: File) {
    setImporting(true); setLog([]);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { ttTrips?: StandaloneTrip[]; trips?: StandaloneTrip[] };
      const trips = parsed.ttTrips ?? parsed.trips ?? [];
      if (!Array.isArray(trips) || trips.length === 0) {
        toast.error('No se encontraron viajes en el JSON (campos esperados: ttTrips o trips).');
        setImporting(false);
        return;
      }
      const results: string[] = [];
      for (const t of trips) {
        const r = await importTrip(t);
        results.push(`${r.ok ? '✅' : '❌'} ${r.tripNo ?? t.title ?? '?'} — ${r.msg}`);
        setLog([...results]);
      }
      const okCount = results.filter((r) => r.startsWith('✅')).length;
      toast.success(`Import completo: ${okCount}/${results.length} viajes.`);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="💾 Respaldo · Backup" size="lg">
      <div className="space-y-4">
        <section className="rounded-md border border-teal/30 p-3">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-teal-d">📤 Exportar</div>
          <p className="mb-2 text-xs text-dark-2">
            Descarga TODOS los viajes + servicios como un archivo JSON. Útil como
            respaldo local o para transferir a otra instancia CEA.
          </p>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="rounded-md bg-teal px-4 py-2 text-xs font-extrabold text-white hover:bg-teal-d disabled:opacity-50"
          >
            {exporting ? 'Exportando…' : '⬇ Descargar JSON'}
          </button>
        </section>

        <section className="rounded-md border border-gold/30 p-3">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-gold">📥 Importar</div>
          <p className="mb-2 text-xs text-dark-2">
            Carga un JSON del standalone HTML (formato <code>{'{ ttTrips: [...] }'}</code>)
            o de un export previo. Los viajes se agregan como nuevos (no reemplazan
            existentes).
          </p>
          <p className="mb-2 text-[11px] italic text-dark-3">
            ⚠️ MVP: por ahora solo se importan los metadatos del viaje (título,
            fechas, país, destino, participantes, motivo). El mapping completo
            de servicios (14 tipos) se hace en fase F19-4 con un skill dedicado.
          </p>
          <label className="inline-block cursor-pointer rounded-md bg-gold px-4 py-2 text-xs font-extrabold text-white hover:opacity-90">
            {importing ? 'Importando…' : '⬆ Cargar JSON…'}
            <input
              type="file"
              accept=".json,application/json"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
        </section>

        {log.length > 0 && (
          <section className="rounded-md border border-sand p-3">
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-dark-2">Log de import</div>
            <div className="max-h-40 space-y-1 overflow-y-auto text-[11px] font-mono text-dark-2">
              {log.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </section>
        )}

        <div className="text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Función util para descargar por nombre desde otros lugares (share).
export const _slug = slug;
