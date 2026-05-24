import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { CatalogPage } from './components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { EntidadForm } from './components/EntidadForm';
import { AutorizadorForm } from './components/AutorizadorForm';
import { EmpleadoForm } from './components/EmpleadoForm';
import { TipoPagoForm } from './components/TipoPagoForm';
import { ProveedorForm } from './components/ProveedorForm';
import { TarjetaForm } from './components/TarjetaForm';
import {
  useAutorizadores,
  useCreateAutorizador,
  useCreateEmpleado,
  useCreateEntidad,
  useCreateProveedor,
  useCreateTarjeta,
  useCreateTipoPago,
  useDeleteAutorizador,
  useDeleteEmpleado,
  useDeleteEntidad,
  useDeleteProveedor,
  useDeleteTarjeta,
  useDeleteTipoPago,
  useEmpleados,
  useEntidades,
  useEntidadesRealtime,
  useProveedores,
  useTarjetas,
  useTiposPago,
  useUpdateAutorizador,
  useUpdateEmpleado,
  useUpdateEntidad,
  useUpdateProveedor,
  useUpdateTarjeta,
  useUpdateTipoPago,
} from './hooks';
import type {
  Autorizador,
  Empleado,
  Entidad,
  Proveedor,
  Tarjeta,
  TipoPago,
} from './api';

type CatalogKey =
  | 'entidades'
  | 'autorizadores'
  | 'empleados'
  | 'tipos_pago'
  | 'proveedores'
  | 'tarjetas';

const tabs: { key: CatalogKey; label: string }[] = [
  { key: 'entidades', label: 'Entidades' },
  { key: 'autorizadores', label: 'Autorizadores' },
  { key: 'empleados', label: 'Empleados' },
  { key: 'tipos_pago', label: 'Tipos de pago' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'tarjetas', label: 'Tarjetas de crédito' },
];

export default function AdminPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.rol === 'admin';
  const [tab, setTab] = useState<CatalogKey>('entidades');

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-dark">Admin</h1>
        <p className="mt-1 text-sm text-dark-2">
          Catálogos compartidos. {isAdmin ? 'Puedes crear, editar y borrar.' : 'Solo lectura.'}
        </p>
      </header>

      <div className="overflow-hidden rounded-card border border-sand bg-white p-1 shadow-sm">
        <nav className="flex flex-wrap gap-1" aria-label="Catálogos">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                tab === t.key
                  ? 'bg-teal text-white shadow-sm'
                  : 'text-dark-2 hover:bg-sand-l hover:text-teal-d',
              ].join(' ')}
              aria-current={tab === t.key ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'entidades' && <EntidadesCatalog canEdit={isAdmin} />}
      {tab === 'autorizadores' && <AutorizadoresCatalog canEdit={isAdmin} />}
      {tab === 'empleados' && <EmpleadosCatalog canEdit={isAdmin} />}
      {tab === 'tipos_pago' && <TiposPagoCatalog canEdit={isAdmin} />}
      {tab === 'proveedores' && <ProveedoresCatalog canEdit={isAdmin} />}
      {tab === 'tarjetas' && <TarjetasCatalog canEdit={isAdmin} />}
    </section>
  );
}

// ============================================================
// Entidades
// ============================================================
function EntidadesCatalog({ canEdit }: { canEdit: boolean }) {
  const query = useEntidades();
  const create = useCreateEntidad();
  const update = useUpdateEntidad();
  const remove = useDeleteEntidad();
  useEntidadesRealtime();

  const columns: DataTableColumn<Entidad>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    { key: 'nit', header: 'NIT', sortable: true, accessor: (r) => r.nit, render: (r) => r.nit ?? '—' },
    {
      key: 'contacto',
      header: 'Contacto',
      sortable: true,
      accessor: (r) => r.contacto,
      render: (r) => r.contacto ?? '—',
    },
    { key: 'telefono', header: 'Teléfono', accessor: (r) => r.telefono, render: (r) => r.telefono ?? '—' },
    { key: 'email', header: 'Email', accessor: (r) => r.email, render: (r) => r.email ?? '—' },
  ];

  return (
    <CatalogPage
      title="Entidades"
      description="Empresas y organizaciones registradas."
      newLabel="+ Nueva entidad"
      columns={columns}
      rows={query.data ?? []}
      loading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
      onDelete={(id) => remove.mutateAsync(id)}
      submitting={create.isPending || update.isPending}
      Form={EntidadForm}
      rowLabel={(r) => r.nombre}
      canEdit={canEdit}
    />
  );
}

// ============================================================
// Autorizadores
// ============================================================
function AutorizadoresCatalog({ canEdit }: { canEdit: boolean }) {
  const query = useAutorizadores();
  const create = useCreateAutorizador();
  const update = useUpdateAutorizador();
  const remove = useDeleteAutorizador();

  const columns: DataTableColumn<Autorizador>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    { key: 'nit', header: 'NIT', sortable: true, accessor: (r) => r.nit, render: (r) => r.nit ?? '—' },
    { key: 'dir', header: 'Dirección', accessor: (r) => r.dir, render: (r) => r.dir ?? '—' },
  ];

  return (
    <CatalogPage
      title="Autorizadores"
      description="Personas autorizadas para aprobar consumos, reintegros y pagos."
      newLabel="+ Nuevo autorizador"
      modalSize="md"
      columns={columns}
      rows={query.data ?? []}
      loading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
      onDelete={(id) => remove.mutateAsync(id)}
      submitting={create.isPending || update.isPending}
      Form={AutorizadorForm}
      rowLabel={(r) => r.nombre}
      canEdit={canEdit}
    />
  );
}

// ============================================================
// Empleados
// ============================================================
function EmpleadosCatalog({ canEdit }: { canEdit: boolean }) {
  const query = useEmpleados();
  const create = useCreateEmpleado();
  const update = useUpdateEmpleado();
  const remove = useDeleteEmpleado();

  const columns: DataTableColumn<Empleado>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    { key: 'puesto', header: 'Puesto', sortable: true, accessor: (r) => r.puesto, render: (r) => r.puesto ?? '—' },
    { key: 'depto', header: 'Depto', sortable: true, accessor: (r) => r.depto, render: (r) => r.depto ?? '—' },
  ];

  return (
    <CatalogPage
      title="Empleados"
      description="Personal interno (alimenta selectores en otros módulos)."
      newLabel="+ Nuevo empleado"
      modalSize="md"
      columns={columns}
      rows={query.data ?? []}
      loading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
      onDelete={(id) => remove.mutateAsync(id)}
      submitting={create.isPending || update.isPending}
      Form={EmpleadoForm}
      rowLabel={(r) => r.nombre}
      canEdit={canEdit}
    />
  );
}

// ============================================================
// Tipos de pago
// ============================================================
function TiposPagoCatalog({ canEdit }: { canEdit: boolean }) {
  const query = useTiposPago();
  const create = useCreateTipoPago();
  const update = useUpdateTipoPago();
  const remove = useDeleteTipoPago();

  const columns: DataTableColumn<TipoPago>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      accessor: (r) => r.tipo,
      render: (r) => <span className="font-medium text-dark">{r.tipo}</span>,
    },
  ];

  return (
    <CatalogPage
      title="Tipos de pago"
      description="Categorías que se usan al registrar pagos a proveedores."
      newLabel="+ Nuevo tipo"
      modalSize="sm"
      columns={columns}
      rows={query.data ?? []}
      loading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
      onDelete={(id) => remove.mutateAsync(id)}
      submitting={create.isPending || update.isPending}
      Form={TipoPagoForm}
      rowLabel={(r) => r.tipo}
      canEdit={canEdit}
    />
  );
}

// ============================================================
// Proveedores
// ============================================================
function ProveedoresCatalog({ canEdit }: { canEdit: boolean }) {
  const query = useProveedores();
  const create = useCreateProveedor();
  const update = useUpdateProveedor();
  const remove = useDeleteProveedor();

  const columns: DataTableColumn<Proveedor>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    { key: 'razon', header: 'Razón social', sortable: true, accessor: (r) => r.razon, render: (r) => r.razon ?? '—' },
    { key: 'nit', header: 'NIT', accessor: (r) => r.nit, render: (r) => r.nit ?? '—' },
    { key: 'giro', header: 'Giro', sortable: true, accessor: (r) => r.giro, render: (r) => r.giro ?? '—' },
    {
      key: 'contacto',
      header: 'Contacto',
      accessor: (r) => r.contacto,
      render: (r) =>
        r.contacto || r.celcontacto ? (
          <span>
            {r.contacto ?? '—'}
            {r.celcontacto && <span className="block text-xs text-dark-3">{r.celcontacto}</span>}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'tel', header: 'Tel', accessor: (r) => r.tel, render: (r) => r.tel ?? '—' },
  ];

  return (
    <CatalogPage
      title="Proveedores"
      description="Proveedores reales (no es el directorio — eso va con CEA)."
      newLabel="+ Nuevo proveedor"
      columns={columns}
      rows={query.data ?? []}
      loading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
      onDelete={(id) => remove.mutateAsync(id)}
      submitting={create.isPending || update.isPending}
      Form={ProveedorForm}
      rowLabel={(r) => r.nombre}
      canEdit={canEdit}
    />
  );
}

// ============================================================
// Tarjetas de crédito
// ============================================================
function TarjetasCatalog({ canEdit }: { canEdit: boolean }) {
  const query = useTarjetas();
  const create = useCreateTarjeta();
  const update = useUpdateTarjeta();
  const remove = useDeleteTarjeta();

  const tipoLabel = { corporativa: 'Corporativa', presidencia: 'Presidencia' } as const;

  const columns: DataTableColumn<Tarjeta>[] = [
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      accessor: (r) => r.tipo,
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            r.tipo === 'corporativa' ? 'bg-teal-l text-teal-d' : 'bg-gold-light text-gold'
          }`}
        >
          {tipoLabel[r.tipo]}
        </span>
      ),
    },
    {
      key: 'tc_id',
      header: 'Identificador',
      sortable: true,
      accessor: (r) => r.tc_id,
      render: (r) => <span className="font-mono text-dark">{r.tc_id}</span>,
    },
    { key: 'red', header: 'Red', sortable: true, accessor: (r) => r.red, render: (r) => r.red ?? '—' },
    { key: 'banco', header: 'Banco', accessor: (r) => r.banco, render: (r) => r.banco ?? '—' },
    {
      key: 'detalle',
      header: 'Detalle',
      accessor: (r) => r.empresa ?? r.titular ?? '',
      render: (r) =>
        r.tipo === 'corporativa' ? (
          <span>
            <span className="text-dark">{r.empresa ?? '—'}</span>
            {r.nit && <span className="block text-xs text-dark-3">NIT {r.nit}</span>}
          </span>
        ) : (
          <span className="text-dark">{r.titular ?? '—'}</span>
        ),
    },
    { key: 'limite', header: 'Límite', accessor: (r) => r.limite, render: (r) => r.limite ?? '—' },
  ];

  return (
    <CatalogPage
      title="Tarjetas de crédito"
      description="Tarjetas corporativas y de presidencia. El formulario cambia según el tipo."
      newLabel="+ Nueva tarjeta"
      modalSize="lg"
      columns={columns}
      rows={query.data ?? []}
      loading={query.isLoading}
      isError={query.isError}
      error={query.error}
      onRetry={() => void query.refetch()}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
      onDelete={(id) => remove.mutateAsync(id)}
      submitting={create.isPending || update.isPending}
      Form={TarjetaForm}
      rowLabel={(r) => `${tipoLabel[r.tipo]} ${r.tc_id}`}
      canEdit={canEdit}
    />
  );
}
