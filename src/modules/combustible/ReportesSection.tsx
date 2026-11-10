import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { DocumentAttachment } from '@/components/ui/DocumentAttachment';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { describeError, useEmpleados, usePersonas } from '@/modules/admin/hooks';
import { useAuth } from '@/lib/auth';
import { useVehiculos } from '@/modules/admin/vehiculos/hooks';
import { REPORTE_ESTADO_LABEL, type Reporte, type Solicitud } from './api';
import {
  useAsignarAReporte,
  useBorrarReporte,
  useCerrarReporte,
  useCrearReporte,
  useEnviarAPagos,
  useReabrirReporte,
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
 *
 * LOS VALES ENTRAN SOLOS, por la fecha, en el control abierto de su quincena
 * (trigger `comb_solicitudes_al_control`). Esta pantalla no asigna nada en el
 * uso normal: ensena lo que hay, y deja corregirlo.
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

export function ReportesSection({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useAuth();
  const esAdmin = profile?.rol === 'admin';

  const reportesQ = useReportes();
  const solicitudesQ = useSolicitudes();
  const responsablesQ = useResponsables();
  const vehiculosQ = useVehiculos();
  const empleadosQ = useEmpleados();
  const personasQ = usePersonas();

  const crear = useCrearReporte();
  const cerrar = useCerrarReporte();
  const enviar = useEnviarAPagos();
  const asignar = useAsignarAReporte();
  const borrar = useBorrarReporte();
  const reabrir = useReabrirReporte();

  const [nuevo, setNuevo] = useState(false);
  const [imprimir, setImprimir] = useState<Reporte | null>(null);
  const [gestionar, setGestionar] = useState<Reporte | null>(null);
  /**
   * El PDF que respalda la quincena --vales, despachos, facturas y
   * contrasenas en un solo archivo. Se carga AQUI y no en la solicitud de
   * pago porque es aqui donde se arma; la SP es el final de cadenas
   * distintas y cada una trae el suyo desde donde nacio.
   *
   * Desde la SP se ve sin tener que volver a subirlo: la politica de
   * `documentos` sigue la cadena hasta ella, asi que lo ven tambien quien
   * la firma y quien la recibe.
   */
  const [expediente, setExpediente] = useState<Reporte | null>(null);

  const vehiculoPorId = useMemo(
    () => new Map((vehiculosQ.data ?? []).map((v) => [v.id, v])),
    [vehiculosQ.data],
  );
  const empleadoPorId = useMemo(
    () => new Map((empleadosQ.data ?? []).map((e) => [e.id, e])),
    [empleadosQ.data],
  );
  // Los gerentes de junta viven en Personal JD y no en la planilla, asi que
  // el cuadro puede apuntar a cualquiera de las dos listas.
  const personaPorId = useMemo(
    () => new Map((personasQ.data ?? []).map((p) => [p.id, p])),
    [personasQ.data],
  );

  const valesDe = (r: Reporte) => (solicitudesQ.data ?? []).filter((s) => s.reporte_id === r.id);

  /** Arma los cuadros de un reporte, en el orden del catalogo. */
  function bloquesDe(reporte: Reporte): Bloque[] {
    const filas = valesDe(reporte);
    return (responsablesQ.data ?? [])
      .filter((r) => r.activo)
      .map((r) => {
        const emp = r.empleado_id ? empleadoPorId.get(r.empleado_id) : null;
        const per = r.persona_id ? personaPorId.get(r.persona_id) : null;
        const veh = r.vehiculo_id ? vehiculoPorId.get(r.vehiculo_id) : null;
        // Personal JD no guarda puesto, asi que ahi manda `puesto_label`.
        const quien = per?.nombre ?? emp?.nombre ?? null;
        const cargo = r.puesto_label ?? emp?.puesto ?? '';

        /**
         * QUE VA A CADA LADO DEL «Responsable:». No depende del tipo de
         * cuadro --eso decide las columnas-- sino de si el cuadro tiene
         * titulo propio. Se comprobo contra los cuatro casos de la hoja:
         *
         *   Lissa      sin etiqueta  -> izq «Gerente Administrativo», der «LISSA ARRIAZA»
         *   Mensajero  sin etiqueta  -> izq «Mensajero»,              der «JOSE RUIZ»
         *   Compras    con etiqueta  -> izq «VERONICA PEREZ»,         der «DEPARTAMENTO DE COMPRAS»
         *   OTROS      con etiqueta  -> izq «ASISTENTE DE GERENCIAS», der «OTROS»
         *
         * O sea: a la derecha, de quien es el cuadro; a la izquierda, lo que
         * lo describe. Cuando hay etiqueta, el cuadro es del departamento y
         * la persona pasa a ser la descripcion.
         */
        return {
          responsable: r,
          nombre: r.etiqueta ?? quien ?? '',
          puesto: r.etiqueta ? (quien ?? r.puesto_label ?? '') : cargo,
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
      render: (r) => {
        const v = valesDe(r);
        if (v.length === 0) return <span className="text-dark-3">—</span>;
        const sinMonto = v.filter((s) => s.monto == null).length;
        return (
          <span>
            {v.length}
            {sinMonto > 0 && (
              <span
                className="ml-1.5 rounded bg-gold/25 px-1.5 py-0.5 text-[10px] font-semibold text-dark"
                title="Vales sin despacho capturado. El control no cierra hasta tenerlos."
              >
                {sinMonto} sin despacho
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      className: 'text-right',
      sortable: true,
      accessor: (r) => r.total,
      // Mientras esta abierto el total se suma al vuelo; al cerrarlo se
      // congela el del servidor. Son el mismo numero, pero el congelado es
      // el que respalda la solicitud de pago.
      render: (r) => {
        if (r.total != null) return formatMoney(r.total);
        const vivo = valesDe(r).reduce((a, s) => a + (s.monto ?? 0), 0);
        return vivo > 0 ? (
          <span className="text-dark-2">{formatMoney(vivo)}</span>
        ) : (
          <span className="text-dark-3">—</span>
        );
      },
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

  const boton =
    'rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l disabled:opacity-40';
  const botonRojo =
    'rounded-md border border-rust/40 px-3 py-1 text-xs font-semibold text-rust hover:bg-rust-l disabled:opacity-40';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ol className="space-y-1 text-sm text-dark-2">
          <li>
            <strong className="text-dark">1.</strong> Abres el control de la quincena. Los vales
            de esas fechas entran solos, según los vas creando.
          </li>
          <li>
            <strong className="text-dark">2.</strong> <strong>Cerrar</strong> congela el total
            —ya no entran ni salen vales— y deja el documento listo para imprimir.
          </li>
          <li>
            <strong className="text-dark">3.</strong> <strong>Enviar a Pagos</strong> manda el
            aviso para que se le genere la solicitud de pago.
          </li>
        </ol>
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
          <div className="flex flex-wrap justify-end gap-2">
            {canEdit && r.estado === 'abierto' && (
              <button
                className={boton}
                title="Qué vales trae, y sacar o devolver alguno a mano"
                onClick={() => setGestionar(r)}
              >
                Vales
              </button>
            )}
            <button className={boton} onClick={() => setImprimir(r)}>
              Imprimir
            </button>
            <button
              className={boton}
              title="El PDF de respaldo de la quincena. Viaja con la solicitud de pago."
              onClick={() => setExpediente(r)}
            >
              📎 Expediente
            </button>
            {canEdit && r.estado === 'abierto' && (
              <button
                className={boton}
                disabled={cerrar.isPending}
                title="Congela el total de la quincena. Después ya no entran ni salen vales."
                onClick={async () => {
                  const v = valesDe(r);
                  const sinMonto = v.filter((s) => s.monto == null);
                  const ok = await confirm({
                    title: `Cerrar ${r.serial ?? 'el control'}`,
                    message:
                      sinMonto.length > 0
                        ? `Faltan ${sinMonto.length} despacho(s): ${sinMonto
                            .map((s) => s.serial)
                            .join(', ')}. Captúralos, o sácalos del control desde «Vales».`
                        : `Se congela el total de ${v.length} vale(s) y el control queda listo para enviar a Pagos. Después ya no entran ni salen vales.`,
                  });
                  if (!ok) return;
                  try {
                    await cerrar.mutateAsync(r.id);
                    toast.success('Control cerrado. Ya puedes enviarlo a Pagos.');
                  } catch (e) {
                    toast.error(describeError(e));
                  }
                }}
              >
                Cerrar
              </button>
            )}
            {canEdit && r.estado === 'cerrado' && (
              <button
                className={boton}
                disabled={enviar.isPending}
                onClick={async () => {
                  try {
                    await enviar.mutateAsync(r.id);
                    toast.success('Aviso enviado a Pagos.');
                  } catch (e) {
                    toast.error(describeError(e));
                  }
                }}
              >
                Enviar a Pagos
              </button>
            )}
            {/* El camino de vuelta de «Cerrar». Solo admin, y solo desde
                «cerrado»: uno ya enviado se devuelve con el Revertir de la
                bandeja de Pagos, que es donde ella pidió que viviera. */}
            {esAdmin && r.estado === 'cerrado' && (
              <button
                className={boton}
                disabled={reabrir.isPending}
                title="Descongela el total y deja volver a tocar sus vales"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Reabrir ${r.serial ?? 'el control'}`,
                    message:
                      'El total se descongela y sus vales vuelven a poder editarse, ' +
                      'salir del control o borrarse. Queda registrado en auditoría.',
                  });
                  if (!ok) return;
                  try {
                    await reabrir.mutateAsync(r.id);
                    toast.success('Control reabierto.');
                  } catch (e) {
                    toast.error(describeError(e));
                  }
                }}
              >
                Reabrir
              </button>
            )}
            {/* Mientras no se haya enviado. Uno ya en Pagos respalda una
                solicitud: ese se devuelve primero con el Revertir. */}
            {canDelete && (r.estado === 'abierto' || r.estado === 'cerrado') && (
              <button
                className={botonRojo}
                disabled={borrar.isPending}
                onClick={async () => {
                  const n = valesDe(r).length;
                  const ok = await confirm({
                    title: `Borrar ${r.serial ?? 'el control'}`,
                    message:
                      n > 0
                        ? `Sus ${n} vale(s) quedan sueltos y entrarán en el siguiente control que cubra sus fechas. Los vales no se borran.`
                        : 'El control desaparece de la lista. Queda el rastro en auditoría.',
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await borrar.mutateAsync(r.id);
                    toast.success('Control borrado.');
                  } catch (e) {
                    toast.error(describeError(e));
                  }
                }}
              >
                Borrar
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
              toast.success('Control creado con los vales de esas fechas.');
              setNuevo(false);
            } catch (e) {
              toast.error(describeError(e));
            }
          }}
        />
      </Modal>

      {/* ── Qué vales trae, y la correccion a mano ────────────────── */}
      <Modal
        open={gestionar != null}
        onClose={() => setGestionar(null)}
        title={`Vales de ${gestionar?.serial ?? ''}`}
        size="lg"
      >
        {gestionar && (
          <Vales
            reporte={gestionar}
            solicitudes={solicitudesQ.data ?? []}
            onAsignar={async (ids, reporteId) => {
              try {
                await asignar.mutateAsync({ ids, reporteId });
              } catch (e) {
                toast.error(describeError(e));
              }
            }}
          />
        )}
      </Modal>

      {/* ── El PDF de respaldo de la quincena ─────────────────────── */}
      <Modal
        open={expediente != null}
        onClose={() => setExpediente(null)}
        title={`Expediente · ${expediente?.serial ?? ''}`}
        size="md"
      >
        {expediente && (
          <div className="space-y-3">
            <p className="rounded-md border border-sand bg-sand-l/40 px-3 py-2 text-xs text-dark-2">
              Un PDF con los vales, despachos, facturas y contraseñas de la quincena.
              Cuando este control llegue a una solicitud de pago,{' '}
              <strong>quien la firme y quien la reciba verán esto mismo</strong> sin que
              tengas que volver a subirlo.
            </p>
            <DocumentAttachment
              entidadTipo="comb_reporte"
              entidadId={expediente.id}
              canEdit={canEdit}
              label="Respaldo de la quincena"
              accept="application/pdf,image/*"
            />
          </div>
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

      {responsablesQ.data?.length === 0 && (
        <p className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-dark-2">
          No hay cuadros definidos, así que el documento sale vacío aunque el control tenga
          vales. Se configuran en <strong>Admin → Responsables de combustible</strong>.
        </p>
      )}
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
      <p className="text-sm text-dark-2">
        Viene propuesta la quincena en curso. Los vales con fecha dentro del periodo —los que ya
        existen y los que crees después— entran solos.
      </p>
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

/**
 * Lo que trae el control, y la correccion a mano.
 *
 * El caso normal no pasa por aqui. Esto es para el vale que se quedo sin
 * despacho al cerrar la quincena: se saca, y entra en la siguiente.
 */
function Vales({
  reporte,
  solicitudes,
  onAsignar,
}: {
  reporte: Reporte;
  solicitudes: Solicitud[];
  onAsignar: (ids: string[], reporteId: string | null) => void;
}) {
  const dentro = solicitudes.filter((s) => s.reporte_id === reporte.id);

  // Lo que podria entrar y no esta: vales del periodo que alguien saco a
  // mano. Los que no estan por no existir todavia entran solos al crearlos.
  const fuera = solicitudes.filter(
    (s) =>
      s.reporte_id == null &&
      s.estado !== 'anulada' &&
      (s.fecha ?? '') >= reporte.periodo_ini &&
      (s.fecha ?? '') <= reporte.periodo_fin,
  );

  const total = dentro.reduce((a, s) => a + (s.monto ?? 0), 0);
  const sinMonto = dentro.filter((s) => s.monto == null).length;

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
        {s.monto != null ? formatMoney(s.monto) : <span className="text-rust">sin despacho</span>}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="rounded-md border border-sand bg-sand-l/40 px-3 py-2 text-xs text-dark-2">
        Los vales entran aquí solos, por su fecha. Saca uno solo si no va a entrar en esta
        quincena —el que se quedó sin despacho, por ejemplo—; pasará al control siguiente que
        cubra su fecha.
      </p>

      <div>
        <h4 className="mb-1 flex items-baseline justify-between text-sm font-semibold text-dark">
          <span>En este control ({dentro.length})</span>
          <span className="font-normal text-dark-2">
            {formatMoney(total)}
            {sinMonto > 0 && <span className="ml-2 text-rust">· {sinMonto} sin despacho</span>}
          </span>
        </h4>
        {dentro.length === 0 && (
          <p className="text-sm text-dark-3">
            Ninguno todavía: no hay vales con fecha entre {formatDate(reporte.periodo_ini)} y{' '}
            {formatDate(reporte.periodo_fin)}.
          </p>
        )}
        {dentro.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="flex-1">{linea(s)}</div>
            <button
              type="button"
              onClick={() => onAsignar([s.id], null)}
              className="rounded-md border border-rust/40 px-3 py-1 text-xs font-semibold text-rust hover:bg-rust-l"
            >
              Sacar
            </button>
          </div>
        ))}
      </div>

      {fuera.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-dark">Sacados a mano ({fuera.length})</h4>
            <button
              type="button"
              onClick={() => onAsignar(
                fuera.map((s) => s.id),
                reporte.id,
              )}
              className="rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l"
            >
              Devolver todos
            </button>
          </div>
          {fuera.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className="flex-1">{linea(s)}</div>
              <button
                type="button"
                onClick={() => onAsignar([s.id], reporte.id)}
                className="rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l"
              >
                Devolver
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
