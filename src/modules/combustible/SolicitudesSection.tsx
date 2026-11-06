import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/dates';
import { formatMoney, parseNumero } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useEmpleados, usePersonas, useProveedores } from '@/modules/admin/hooks';
import { useVehiculos } from '@/modules/admin/vehiculos/hooks';
import { enviosApi } from '@/modules/tesoreria/api';
import {
  ESTADO_COLOR,
  ESTADO_LABEL,
  estadoAlcanzado,
  type Solicitud,
  type SolicitudUpdate,
} from './api';
import {
  useActualizarSolicitud,
  useBorrarSolicitud,
  useCrearSolicitud,
  useInvalidarTrasEnvio,
  useResponsables,
  useSolicitudes,
} from './hooks';
import { SolicitudForm } from './SolicitudForm';
import { SolicitudValePrintable } from './SolicitudValePrintable';

/** Quien puede recibir una solicitud de vale: los usuarios de tesoreria. */
function useTesoreros() {
  return useQuery({
    queryKey: ['usuarios_tesoreria'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, email, rol')
        .eq('activo', true);
      if (error) throw error;
      return (data ?? []).filter((u) => u.rol === 'tesoreria' || u.rol === 'admin');
    },
  });
}

type Dialogo =
  | { tipo: 'cerrado' }
  | { tipo: 'nueva' }
  | { tipo: 'editar'; s: Solicitud }
  | { tipo: 'imprimir'; s: Solicitud }
  | { tipo: 'enviar'; s: Solicitud }
  | { tipo: 'despacho'; s: Solicitud }
  | { tipo: 'documentos'; s: Solicitud };

export function SolicitudesSection({
  canEdit,
  canDelete,
}: {
  canEdit: boolean;
  /** Borrar es del administrador y de nadie mas. La base lo vuelve a exigir. */
  canDelete: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const solicitudesQ = useSolicitudes();
  const responsablesQ = useResponsables();
  const vehiculosQ = useVehiculos();
  const empleadosQ = useEmpleados();
  const personasQ = usePersonas();
  const proveedoresQ = useProveedores();
  const tesorerosQ = useTesoreros();

  const crear = useCrearSolicitud();
  const actualizar = useActualizarSolicitud();
  const borrar = useBorrarSolicitud();
  const invalidarTrasEnvio = useInvalidarTrasEnvio();

  const [dlg, setDlg] = useState<Dialogo>({ tipo: 'cerrado' });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busca, setBusca] = useState('');

  const vehiculos = useMemo(
    () => (vehiculosQ.data ?? []).map((v) => ({ id: v.id, marca: v.marca, placa: v.placa, tipo: v.tipo })),
    [vehiculosQ.data],
  );
  const vehiculoPorId = useMemo(() => new Map(vehiculos.map((v) => [v.id, v])), [vehiculos]);
  const personaPorId = useMemo(
    () => new Map((personasQ.data ?? []).map((p) => [p.id, p.nombre])),
    [personasQ.data],
  );
  const empleadoPorId = useMemo(
    () => new Map((empleadosQ.data ?? []).map((e) => [e.id, e.nombre])),
    [empleadosQ.data],
  );

  const filas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (solicitudesQ.data ?? []).filter((s) => {
      if (filtroEstado && s.estado !== filtroEstado) return false;
      if (!q) return true;
      return [s.serial, s.vale_a, s.vale_num, s.recibo_num, s.factura_numero, s.justificacion]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [solicitudesQ.data, filtroEstado, busca]);

  async function enviarAlTesorero(s: Solicitud, destinatarioId: string) {
    const veh = s.vehiculo_id ? vehiculoPorId.get(s.vehiculo_id) : null;
    try {
      // El snapshot es lo que el Tesorero va a ver. Lleva todo lo que necesita
      // para decidir, porque el no puede leer esta tabla.
      await enviosApi.enviar({
        destinatarioId,
        docTipo: 'comb_solicitud',
        docId: s.id,
        snapshot: {
          serial: s.serial ?? '',
          fecha: s.fecha ?? '',
          titulo: `Solicitud de vale ${s.serial ?? ''}`,
          monto: s.monto_autorizado ?? undefined,
          moneda: 'GTQ',
          detalle: s.justificacion ?? '',
          campos: [
            { etiqueta: 'Vale a', valor: s.vale_a ?? '—' },
            { etiqueta: 'Vehículo', valor: veh ? `${veh.marca} · ${veh.placa}` : '—' },
            { etiqueta: 'Tipo', valor: veh?.tipo ?? '—' },
            { etiqueta: 'Departamento', valor: s.departamento ?? '—' },
            {
              etiqueta: 'Autorizado por',
              valor: s.autorizado_por_id ? (personaPorId.get(s.autorizado_por_id) ?? '—') : '—',
            },
          ],
        },
      });
      await actualizar.mutateAsync({ id: s.id, patch: { estado: 'enviada_tesorero' } });
      invalidarTrasEnvio();
      toast.success('Solicitud enviada al tesorero.');
      setDlg({ tipo: 'cerrado' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo enviar.');
    }
  }

  async function guardarParche(s: Solicitud, patch: SolicitudUpdate, mensaje: string) {
    try {
      await actualizar.mutateAsync({ id: s.id, patch });
      toast.success(mensaje);
      setDlg({ tipo: 'cerrado' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  }

  const columnas: DataTableColumn<Solicitud>[] = [
    {
      key: 'serial',
      header: 'Solicitud',
      sortable: true,
      accessor: (s) => s.serial,
      render: (s) => (
        <div>
          <div className="font-medium text-dark">{s.serial ?? '—'}</div>
          <div className="text-xs text-dark-3">{s.fecha ? formatDate(s.fecha) : ''}</div>
        </div>
      ),
    },
    {
      key: 'vale_a',
      header: 'Vale a',
      sortable: true,
      accessor: (s) => s.vale_a,
      render: (s) => s.vale_a ?? '—',
    },
    {
      key: 'vehiculo',
      header: 'Vehículo',
      render: (s) => {
        const v = s.vehiculo_id ? vehiculoPorId.get(s.vehiculo_id) : null;
        if (v) return `${v.marca} · ${v.placa}`;
        return s.vehiculo_desc ?? '—';
      },
    },
    {
      key: 'vale_num',
      header: 'Vale #',
      sortable: true,
      accessor: (s) => s.vale_num,
      render: (s) => s.vale_num ?? <span className="text-dark-3">—</span>,
    },
    {
      key: 'galones',
      header: 'Galones',
      className: 'text-right',
      sortable: true,
      accessor: (s) => s.galones,
      render: (s) => (s.galones != null ? s.galones.toFixed(3) : '—'),
    },
    {
      key: 'monto',
      header: 'Monto',
      className: 'text-right',
      sortable: true,
      accessor: (s) => s.monto,
      render: (s) => (s.monto != null ? formatMoney(s.monto) : '—'),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (s) => s.estado,
      render: (s) => (
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
            ESTADO_COLOR[s.estado] ?? 'bg-sand-l text-dark-2'
          }`}
        >
          {ESTADO_LABEL[s.estado] ?? s.estado}
        </span>
      ),
    },
  ];

  // El mismo molde que usan los catalogos y Caja Chica. Tener un boton con
  // otra forma en una sola pantalla se nota, y lo unico que dice es que esa
  // pantalla se escribio aparte.
  const boton =
    'rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l disabled:opacity-40';
  const botonRojo =
    'rounded-md border border-rust/40 px-3 py-1 text-xs font-semibold text-rust hover:bg-rust-l disabled:opacity-40';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <TextInput
            label="Buscar"
            placeholder="Correlativo, vale, factura…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-56"
          />
          <Select
            label="Estado"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="w-52"
          >
            <option value="">Todos</option>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setDlg({ tipo: 'nueva' })}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90"
          >
            Nueva solicitud de vale
          </button>
        )}
      </div>

      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(s) => s.id}
        loading={solicitudesQ.isLoading}
        error={solicitudesQ.error?.message ?? null}
        onRetry={() => void solicitudesQ.refetch()}
        emptyMessage="Todavía no hay solicitudes de vale."
        actions={(s) => (
          <div className="flex flex-wrap justify-end gap-2">
            <button className={boton} onClick={() => setDlg({ tipo: 'imprimir', s })}>
              Imprimir
            </button>
            {canEdit && s.estado === 'borrador' && (
              <button className={boton} onClick={() => setDlg({ tipo: 'enviar', s })}>
                Al tesorero
              </button>
            )}
            {canEdit && estadoAlcanzado(s.estado, 'vale_emitido') && (
              <button className={boton} onClick={() => setDlg({ tipo: 'despacho', s })}>
                Despacho
              </button>
            )}
            {canEdit && estadoAlcanzado(s.estado, 'despachada') && (
              <button className={boton} onClick={() => setDlg({ tipo: 'documentos', s })}>
                Factura
              </button>
            )}
            {canEdit && !estadoAlcanzado(s.estado, 'en_reporte') && (
              <button className={boton} onClick={() => setDlg({ tipo: 'editar', s })}>
                Editar
              </button>
            )}
            {/*
              Borrar no depende del estado, a proposito: hace falta justamente
              para lo ya enviado --las pruebas que hay que limpiar. La base
              pone los dos frenos que si importan: solo admin, y nunca un
              renglon de un control ya cerrado.
            */}
            {canDelete && (
              <button
                className={botonRojo}
                disabled={borrar.isPending}
                onClick={async () => {
                  const enControl = s.reporte_id != null;
                  const conTesorero = s.estado === 'enviada_tesorero';
                  const ok = await confirm({
                    title: `Borrar ${s.serial ?? 'la solicitud'}`,
                    message: [
                      'Desaparece de la lista. Queda el rastro en auditoría.',
                      enControl && 'Sale del control de vales de su quincena y el total baja.',
                      conTesorero && 'Se retira de la bandeja del tesorero.',
                    ]
                      .filter(Boolean)
                      .join(' '),
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await borrar.mutateAsync(s.id);
                    toast.success('Solicitud borrada.');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'No se pudo borrar.');
                  }
                }}
              >
                Borrar
              </button>
            )}
          </div>
        )}
      />

      {/* ── Crear / editar ────────────────────────────────────────── */}
      <Modal
        open={dlg.tipo === 'nueva' || dlg.tipo === 'editar'}
        onClose={() => setDlg({ tipo: 'cerrado' })}
        title={dlg.tipo === 'editar' ? 'Editar solicitud de vale' : 'Nueva solicitud de vale'}
        size="lg"
      >
        <SolicitudForm
          inicial={dlg.tipo === 'editar' ? dlg.s : null}
          vehiculos={vehiculos}
          empleados={(empleadosQ.data ?? []).map((e) => ({
            id: e.id,
            nombre: e.nombre,
            puesto: e.puesto,
          }))}
          personas={(personasQ.data ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))}
          guardando={crear.isPending || actualizar.isPending}
          onCancel={() => setDlg({ tipo: 'cerrado' })}
          onSubmit={async (valores) => {
            try {
              if (dlg.tipo === 'editar') {
                await actualizar.mutateAsync({ id: dlg.s.id, patch: valores });
                toast.success('Solicitud actualizada.');
              } else {
                await crear.mutateAsync(valores);
                toast.success('Solicitud creada.');
              }
              setDlg({ tipo: 'cerrado' });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'No se pudo guardar.');
            }
          }}
        />
      </Modal>

      {/* ── Enviar al tesorero ────────────────────────────────────── */}
      <Modal
        open={dlg.tipo === 'enviar'}
        onClose={() => setDlg({ tipo: 'cerrado' })}
        title="Enviar al tesorero"
        size="sm"
      >
        {dlg.tipo === 'enviar' && (
          <EnviarAlTesorero
            solicitud={dlg.s}
            tesoreros={tesorerosQ.data ?? []}
            onEnviar={(destinatarioId) => void enviarAlTesorero(dlg.s, destinatarioId)}
            onCancel={() => setDlg({ tipo: 'cerrado' })}
          />
        )}
      </Modal>

      {/* ── Capturar el recibo de despacho ────────────────────────── */}
      <Modal
        open={dlg.tipo === 'despacho'}
        onClose={() => setDlg({ tipo: 'cerrado' })}
        title="Recibo de despacho"
        size="md"
      >
        {dlg.tipo === 'despacho' && (
          <FormDespacho
            solicitud={dlg.s}
            onCancel={() => setDlg({ tipo: 'cerrado' })}
            onGuardar={(patch) =>
              void guardarParche(dlg.s, { ...patch, estado: 'despachada' }, 'Despacho registrado.')
            }
          />
        )}
      </Modal>

      {/* ── Factura y contraseña ──────────────────────────────────── */}
      <Modal
        open={dlg.tipo === 'documentos'}
        onClose={() => setDlg({ tipo: 'cerrado' })}
        title="Factura y contraseña de pago"
        size="md"
      >
        {dlg.tipo === 'documentos' && (
          <FormDocumentos
            solicitud={dlg.s}
            proveedores={(proveedoresQ.data ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))}
            onCancel={() => setDlg({ tipo: 'cerrado' })}
            onGuardar={(patch) =>
              void guardarParche(
                dlg.s,
                { ...patch, estado: 'documentada' },
                'Factura y contraseña registradas.',
              )
            }
          />
        )}
      </Modal>

      {/* ── El formato oficial ────────────────────────────────────── */}
      <PrintableModal
        open={dlg.tipo === 'imprimir'}
        onClose={() => setDlg({ tipo: 'cerrado' })}
        title={dlg.tipo === 'imprimir' ? (dlg.s.serial ?? 'Solicitud de vale') : ''}
      >
        {dlg.tipo === 'imprimir' && (
          <SolicitudValePrintable
            solicitud={dlg.s}
            vehiculo={dlg.s.vehiculo_id ? (vehiculoPorId.get(dlg.s.vehiculo_id) ?? null) : null}
            autorizador={
              dlg.s.autorizado_por_id ? (personaPorId.get(dlg.s.autorizado_por_id) ?? null) : null
            }
            solicitante={
              // Puede venir de cualquiera de las dos listas: los gerentes que
              // piden vales estan en Personal JD, no en la planilla.
              dlg.s.solicitado_por_persona_id
                ? (personaPorId.get(dlg.s.solicitado_por_persona_id) ?? null)
                : dlg.s.solicitado_por_id
                  ? (empleadoPorId.get(dlg.s.solicitado_por_id) ?? null)
                  : null
            }
          />
        )}
      </PrintableModal>

      {responsablesQ.data?.length === 0 && (
        <p className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-dark-2">
          Todavía no hay cuadros definidos. El control de vales los necesita para agrupar:
          se configuran en <strong>Admin → Responsables de combustible</strong>.
        </p>
      )}
    </section>
  );
}

function EnviarAlTesorero({
  solicitud,
  tesoreros,
  onEnviar,
  onCancel,
}: {
  solicitud: Solicitud;
  tesoreros: { id: string; nombre: string | null; email: string | null }[];
  onEnviar: (id: string) => void;
  onCancel: () => void;
}) {
  const [destinatario, setDestinatario] = useState(tesoreros[0]?.id ?? '');
  return (
    <div className="space-y-4">
      <p className="text-sm text-dark-2">
        <strong>{solicitud.serial}</strong> aparecerá en su bandeja. Cuando la acepte y
        registre el número del vale que entregó, el estado de esta solicitud cambia solo.
      </p>
      <Select
        label="Destinatario"
        value={destinatario}
        onChange={(e) => setDestinatario(e.target.value)}
      >
        {tesoreros.length === 0 && <option value="">No hay usuarios de tesorería</option>}
        {tesoreros.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre ?? t.email}
          </option>
        ))}
      </Select>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-sand px-4 py-2 text-sm text-dark-2 hover:bg-sand-l"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!destinatario}
          onClick={() => onEnviar(destinatario)}
          className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-60"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function FormDespacho({
  solicitud: s,
  onGuardar,
  onCancel,
}: {
  solicitud: Solicitud;
  onGuardar: (patch: SolicitudUpdate) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    recibo_num: s.recibo_num ?? '',
    recibo_fecha: s.recibo_fecha ?? '',
    producto: s.producto ?? '',
    galones: s.galones?.toString() ?? '',
    precio_galon: s.precio_galon?.toString() ?? '',
    monto: s.monto?.toString() ?? '',
    bomba: s.bomba ?? '',
    manguera: s.manguera ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const galones = parseNumero(f.galones);
  const precio = parseNumero(f.precio_galon);
  const calculado =
    galones != null && precio != null ? Number((galones * precio).toFixed(2)) : null;

  /**
   * EL TOTAL SE ESCRIBE SOLO: galones por precio, en la casilla, no insinuado
   * en una ayuda debajo. Antes se calculaba igual pero la casilla se quedaba
   * vacia y habia que fiarse de un texto gris.
   *
   * Se puede escribir encima, porque la gasolinera a veces redondea y el
   * comprobante es el que vale. Y si se vacia, vuelve al automatico: borrar
   * es la forma natural de decir «calculalo tu otra vez».
   */
  const [totalManual, setTotalManual] = useState(s.monto != null);
  const totalEnPantalla = totalManual ? f.monto : (calculado?.toFixed(2) ?? '');
  const total = totalManual ? parseNumero(f.monto) : calculado;
  const difiere =
    totalManual && calculado != null && total != null && Math.abs(total - calculado) >= 0.01;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({
          recibo_num: f.recibo_num.trim() || null,
          recibo_fecha: f.recibo_fecha || null,
          producto: f.producto.trim() || null,
          galones,
          precio_galon: precio,
          monto: total != null && total > 0 ? Number(total.toFixed(2)) : null,
          bomba: f.bomba.trim() || null,
          manguera: f.manguera.trim() || null,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Comprobante"
          value={f.recibo_num}
          onChange={(e) => set('recibo_num', e.target.value)}
        />
        <TextInput
          label="Fecha"
          type="date"
          value={f.recibo_fecha}
          onChange={(e) => set('recibo_fecha', e.target.value)}
        />
        <TextInput
          label="Producto"
          placeholder="Super, Regular, Diesel…"
          value={f.producto}
          onChange={(e) => set('producto', e.target.value)}
        />
        <TextInput
          label="Galones"
          inputMode="decimal"
          value={f.galones}
          onChange={(e) => set('galones', e.target.value)}
        />
        <TextInput
          label="Precio por galón"
          inputMode="decimal"
          value={f.precio_galon}
          onChange={(e) => set('precio_galon', e.target.value)}
        />
        <TextInput
          label="Total"
          inputMode="decimal"
          hint={
            difiere && calculado != null
              ? `Ojo: galones × precio da ${formatMoney(calculado)}`
              : totalManual
                ? 'Lo que dice el comprobante. Vacíalo para recalcularlo.'
                : 'Galones × precio. Puedes escribir encima.'
          }
          value={totalEnPantalla}
          onChange={(e) => {
            const v = e.target.value;
            setTotalManual(v.trim() !== '');
            set('monto', v);
          }}
        />
        <TextInput label="Bomba" value={f.bomba} onChange={(e) => set('bomba', e.target.value)} />
        <TextInput
          label="Manguera"
          value={f.manguera}
          onChange={(e) => set('manguera', e.target.value)}
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
          Guardar
        </button>
      </div>
    </form>
  );
}

function FormDocumentos({
  solicitud: s,
  proveedores,
  onGuardar,
  onCancel,
}: {
  solicitud: Solicitud;
  proveedores: { id: string; nombre: string }[];
  onGuardar: (patch: SolicitudUpdate) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    proveedor_id: s.proveedor_id ?? '',
    factura_serie: s.factura_serie ?? '',
    factura_numero: s.factura_numero ?? '',
    factura_fecha: s.factura_fecha ?? '',
    factura_monto: s.factura_monto?.toString() ?? '',
    contrasena_num: s.contrasena_num ?? '',
    contrasena_fecha: s.contrasena_fecha ?? '',
    contrasena_vencimiento: s.contrasena_vencimiento ?? '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({
          proveedor_id: f.proveedor_id || null,
          factura_serie: f.factura_serie.trim() || null,
          factura_numero: f.factura_numero.trim() || null,
          factura_fecha: f.factura_fecha || null,
          factura_monto: f.factura_monto.trim() === '' ? null : Number(f.factura_monto),
          contrasena_num: f.contrasena_num.trim() || null,
          contrasena_fecha: f.contrasena_fecha || null,
          contrasena_vencimiento: f.contrasena_vencimiento || null,
        });
      }}
    >
      <Select
        label="Proveedor"
        value={f.proveedor_id}
        onChange={(e) => set('proveedor_id', e.target.value)}
      >
        <option value="">—</option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </Select>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Serie de la factura"
          value={f.factura_serie}
          onChange={(e) => set('factura_serie', e.target.value)}
        />
        <TextInput
          label="Número"
          value={f.factura_numero}
          onChange={(e) => set('factura_numero', e.target.value)}
        />
        <TextInput
          label="Fecha"
          type="date"
          value={f.factura_fecha}
          onChange={(e) => set('factura_fecha', e.target.value)}
        />
        <TextInput
          label="Monto de la factura"
          inputMode="decimal"
          hint="Referencia. El control de vales suma el despacho."
          value={f.factura_monto}
          onChange={(e) => set('factura_monto', e.target.value)}
        />
      </div>

      <div className="rounded-md border border-sand bg-sand-l/40 p-3">
        <p className="mb-2 text-xs text-dark-2">
          La contraseña <strong>no sale en el control de vales</strong>. Se guarda para el
          expediente y se adjunta en físico.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextInput
            label="Contraseña #"
            value={f.contrasena_num}
            onChange={(e) => set('contrasena_num', e.target.value)}
          />
          <TextInput
            label="Fecha"
            type="date"
            value={f.contrasena_fecha}
            onChange={(e) => set('contrasena_fecha', e.target.value)}
          />
          <TextInput
            label="Vence"
            type="date"
            value={f.contrasena_vencimiento}
            onChange={(e) => set('contrasena_vencimiento', e.target.value)}
          />
        </div>
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
          Guardar
        </button>
      </div>
    </form>
  );
}
