import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useEmpleados } from '@/modules/admin/hooks';
import { useVehiculos } from '@/modules/admin/vehiculos/hooks';
import { REPORTE_ESTADO_LABEL, type Reporte, type Solicitud } from './api';
import {
  useAsignarAReporte,
  useCerrarReporte,
  useCrearReporte,
  useEnviarAPagos,
  useReportes,
  useResponsables,
  useSolicitudes,
} from './hooks';
import { ControlValesPrintable, type Bloque } from './ControlValesPrintable';

/**
 * El control de vales de la quincena.
 *
 * Los cuadros no se guardan: se arman aqui agrupando las solicitudes del
 * periodo por responsable. Por eso el total impreso y el congelado en la base
 * siempre coinciden --y si no coincidieran, seria senal de que alguien edito
 * una solicitud ya cerrada, que es justo lo que hay que poder notar.
 */

/** Por omision, la quincena en curso. */
function quincenaActual(): { ini: string; fin: string } {
  const hoy = new Date();
  const a = hoy.getFullYear();
  const m = hoy.getMonth();
  const dia = hoy.getDate();
  const p = (d: Date) => d.toISOString().slice(0, 10);
  return dia <= 15
    ? { ini: p(new Date(a, m, 1)), fin: p(new Date(a, m, 15)) }
    : { ini: p(new Date(a, m, 16)), fin: p(new Date(a, m + 1, 0)) };
}

export function ReportesSection({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();

  const reportesQ = useReportes();
  const solicitudesQ = useSolicitudes();
  const responsablesQ = useResponsables();
  const vehiculosQ = useVehiculos();
  const empleadosQ = useEmpleados();

  const crear = useCrearReporte();
  const cerrar = useCerrarReporte();
  const enviar = useEnviarAPagos();
  const asignar = useAsignarAReporte();

  const [nuevo, setNuevo] = useState(false);
  const [imprimir, setImprimir] = useState<Reporte | null>(null);
  const [gestionar, setGestionar] = useState<Reporte | null>(null);

  const vehiculoPorId = useMemo(
    () => new Map((vehiculosQ.data ?? []).map((v) => [v.id, v])),
    [vehiculosQ.data],
  );
  const empleadoPorId = useMemo(
    () => new Map((empleadosQ.data ?? []).map((e) => [e.id, e])),
    [empleadosQ.data],
  );

  /** Arma los cuadros de un reporte, en el orden del catalogo. */
  function bloquesDe(reporte: Reporte): Bloque[] {
    const filas = (solicitudesQ.data ?? []).filter((s) => s.reporte_id === reporte.id);
    return (responsablesQ.data ?? [])
      .filter((r) => r.activo)
      .map((r) => {
        const emp = r.empleado_id ? empleadoPorId.get(r.empleado_id) : null;
        const veh = r.vehiculo_id ? vehiculoPorId.get(r.vehiculo_id) : null;
        const asignado = r.tipo_bloque === 'vehiculo_asignado';
        return {
          responsable: r,
          // En los cuadros con carro la hoja pone el NOMBRE a la derecha y el
          // PUESTO a la izquierda. En los de varios, el nombre de la persona
          // va a la izquierda y la etiqueta del departamento a la derecha.
          nombre: asignado ? (emp?.nombre ?? r.etiqueta ?? '') : (r.etiqueta ?? ''),
          puesto: asignado
            ? (r.puesto_label ?? emp?.puesto ?? '')
            : (emp?.nombre ?? r.puesto_label ?? ''),
          vehiculo: veh ? { marca: veh.marca, placa: veh.placa, tipo: veh.tipo } : null,
          filas: filas.filter((s) => s.responsable_id === r.id),
        };
      });
  }

  const columnas: DataTableColumn<Reporte>[] = [
    {
      key: 'serial',
      header: 'Control',
      sortable: true,
      accessor: (r) => r.serial,
      render: (r) => <span className="font-medium text-dark">{r.serial ?? '—'}</span>,
    },
    {
      key: 'periodo',
      header: 'Periodo',
      sortable: true,
      accessor: (r) => r.periodo_ini,
      render: (r) => `${formatDate(r.periodo_ini)} — ${formatDate(r.periodo_fin)}`,
    },
    {
      key: 'renglones',
      header: 'Vales',
      className: 'text-right',
      render: (r) =>
        (solicitudesQ.data ?? []).filter((s) => s.reporte_id === r.id).length || '—',
    },
    {
      key: 'total',
      header: 'Total',
      className: 'text-right',
      sortable: true,
      accessor: (r) => r.total,
      render: (r) => (r.total != null ? formatMoney(r.total) : '—'),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => (
        <span className="inline-block rounded bg-sand-l px-2 py-0.5 text-xs font-medium text-dark-2">
          {REPORTE_ESTADO_LABEL[r.estado] ?? r.estado}
        </span>
      ),
    },
  ];

  const botonChico =
    'rounded border border-sand px-2 py-1 text-xs text-dark-2 hover:bg-sand-l disabled:opacity-40';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-dark-2">
          Cada 15 días: se agrupan los vales documentados, se cierra el control y se manda
          el aviso a Pagos.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setNuevo(true)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90"
          >
            Nuevo control de vales
          </button>
        )}
      </div>

      <DataTable
        data={reportesQ.data ?? []}
        columns={columnas}
        rowKey={(r) => r.id}
        loading={reportesQ.isLoading}
        error={reportesQ.error?.message ?? null}
        onRetry={() => void reportesQ.refetch()}
        emptyMessage="Todavía no hay controles de vales."
        actions={(r) => (
          <div className="flex flex-wrap justify-end gap-1">
            {canEdit && r.estado === 'abierto' && (
              <button className={botonChico} onClick={() => setGestionar(r)}>
                Renglones
              </button>
            )}
            <button className={botonChico} onClick={() => setImprimir(r)}>
              Imprimir
            </button>
            {canEdit && r.estado === 'abierto' && (
              <button
                className={botonChico}
                disabled={cerrar.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Cerrar el control de vales',
                    message:
                      'El total se calcula y se congela. Después no se le pueden mover renglones.',
                  });
                  if (!ok) return;
                  try {
                    await cerrar.mutateAsync(r.id);
                    toast.success('Control cerrado.');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'No se pudo cerrar.');
                  }
                }}
              >
                Cerrar
              </button>
            )}
            {canEdit && r.estado === 'cerrado' && (
              <button
                className={botonChico}
                disabled={enviar.isPending}
                onClick={async () => {
                  try {
                    await enviar.mutateAsync(r.id);
                    toast.success('Aviso enviado a Pagos.');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'No se pudo enviar.');
                  }
                }}
              >
                Enviar a Pagos
              </button>
            )}
          </div>
        )}
      />

      {/* ── Nuevo control ─────────────────────────────────────────── */}
      <Modal open={nuevo} onClose={() => setNuevo(false)} title="Nuevo control de vales" size="sm">
        <FormPeriodo
          onCancel={() => setNuevo(false)}
          onCrear={async (ini, fin) => {
            try {
              await crear.mutateAsync({ periodo_ini: ini, periodo_fin: fin });
              toast.success('Control creado. Ahora asígnale sus vales.');
              setNuevo(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'No se pudo crear.');
            }
          }}
        />
      </Modal>

      {/* ── Qué vales entran ──────────────────────────────────────── */}
      <Modal
        open={gestionar != null}
        onClose={() => setGestionar(null)}
        title={`Renglones de ${gestionar?.serial ?? ''}`}
        size="lg"
      >
        {gestionar && (
          <Renglones
            reporte={gestionar}
            solicitudes={solicitudesQ.data ?? []}
            onAsignar={async (ids, reporteId) => {
              try {
                await asignar.mutateAsync({ ids, reporteId });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'No se pudo actualizar.');
              }
            }}
          />
        )}
      </Modal>

      {/* ── El formato oficial ────────────────────────────────────── */}
      <PrintableModal
        open={imprimir != null}
        onClose={() => setImprimir(null)}
        title={imprimir?.serial ?? ''}
      >
        {imprimir && (
          <ControlValesPrintable
            reporte={imprimir}
            bloques={bloquesDe(imprimir)}
            realizadoPor={
              imprimir.realizado_por_id
                ? {
                    nombre: empleadoPorId.get(imprimir.realizado_por_id)?.nombre ?? '',
                    puesto: empleadoPorId.get(imprimir.realizado_por_id)?.puesto ?? '',
                  }
                : null
            }
          />
        )}
      </PrintableModal>
    </section>
  );
}

function FormPeriodo({
  onCrear,
  onCancel,
}: {
  onCrear: (ini: string, fin: string) => void;
  onCancel: () => void;
}) {
  const q = quincenaActual();
  const [ini, setIni] = useState(q.ini);
  const [fin, setFin] = useState(q.fin);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onCrear(ini, fin);
      }}
    >
      <p className="text-sm text-dark-2">Viene propuesta la quincena en curso.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Del"
          type="date"
          value={ini}
          onChange={(e) => setIni(e.target.value)}
          required
        />
        <TextInput
          label="Al"
          type="date"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          required
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-sand px-4 py-2 text-sm text-dark-2 hover:bg-sand-l"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90"
        >
          Crear
        </button>
      </div>
    </form>
  );
}

function Renglones({
  reporte,
  solicitudes,
  onAsignar,
}: {
  reporte: Reporte;
  solicitudes: Solicitud[];
  onAsignar: (ids: string[], reporteId: string | null) => void;
}) {
  const dentro = solicitudes.filter((s) => s.reporte_id === reporte.id);

  // Candidatas: documentadas, sin control, y dentro del periodo. El filtro por
  // fecha evita meter por error un vale de la quincena pasada.
  const fuera = solicitudes.filter(
    (s) =>
      s.reporte_id == null &&
      (s.estado === 'documentada' || s.estado === 'despachada') &&
      (s.fecha ?? '') >= reporte.periodo_ini &&
      (s.fecha ?? '') <= reporte.periodo_fin,
  );

  const linea = (s: Solicitud) => (
    <div className="flex items-center justify-between gap-2 border-b border-sand-l py-1.5 text-sm">
      <span>
        <span className="font-medium">{s.serial}</span>{' '}
        <span className="text-dark-3">
          {s.fecha ? formatDate(s.fecha) : ''} · {s.vale_a ?? '—'}
          {s.vale_num ? ` · vale ${s.vale_num}` : ''}
        </span>
      </span>
      <span className="whitespace-nowrap">
        {s.monto != null ? formatMoney(s.monto) : <span className="text-rust">sin monto</span>}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-1 text-sm font-semibold text-dark">En este control ({dentro.length})</h4>
        {dentro.length === 0 && <p className="text-sm text-dark-3">Todavía ninguno.</p>}
        {dentro.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="flex-1">{linea(s)}</div>
            <button
              type="button"
              onClick={() => onAsignar([s.id], null)}
              className="rounded border border-sand px-2 py-1 text-xs text-rust hover:bg-sand-l"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-dark">Disponibles ({fuera.length})</h4>
          {fuera.length > 0 && (
            <button
              type="button"
              onClick={() => onAsignar(fuera.map((s) => s.id), reporte.id)}
              className="rounded border border-sand px-2 py-1 text-xs text-teal hover:bg-sand-l"
            >
              Agregar todos
            </button>
          )}
        </div>
        {fuera.length === 0 && (
          <p className="text-sm text-dark-3">
            No hay vales documentados sin control dentro del periodo.
          </p>
        )}
        {fuera.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="flex-1">{linea(s)}</div>
            <button
              type="button"
              onClick={() => onAsignar([s.id], reporte.id)}
              className="rounded border border-sand px-2 py-1 text-xs text-teal hover:bg-sand-l"
            >
              Agregar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
