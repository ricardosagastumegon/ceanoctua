import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { CatalogPage } from './components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { CsvImporter, type ColumnMapping } from '@/components/ui/CsvImporter';
import { EntidadForm } from './components/EntidadForm';
import { PersonaForm } from './components/PersonaForm';
import { EmpleadoForm } from './components/EmpleadoForm';
import { TipoPagoForm } from './components/TipoPagoForm';
import { ProveedorForm } from './components/ProveedorForm';
import { TarjetaForm } from './components/TarjetaForm';
import { StatusSpForm } from './components/StatusSpForm';
import {
  useCreateEmpleado,
  useCreateEntidad,
  useCreatePersona,
  useCreateProveedor,
  useCreateStatusSp,
  useCreateTarjeta,
  useCreateTipoPago,
  useDeleteEmpleado,
  useDeleteEntidad,
  useDeletePersona,
  useDeleteProveedor,
  useDeleteStatusSp,
  useDeleteTarjeta,
  useDeleteTipoPago,
  useEmpleados,
  useEntidades,
  useEntidadesRealtime,
  usePersonas,
  useProveedores,
  useStatusSp,
  useTarjetas,
  useTiposPago,
  useUpdateEmpleado,
  useUpdateEntidad,
  useUpdatePersona,
  useUpdateProveedor,
  useUpdateStatusSp,
  useUpdateTarjeta,
  useUpdateTipoPago,
} from './hooks';
import type {
  Empleado,
  Entidad,
  Persona,
  Proveedor,
  StatusSp,
  Tarjeta,
  TipoPago,
} from './api';

type CatalogKey =
  | 'entidades'
  | 'personas'
  | 'empleados'
  | 'tipos_pago'
  | 'proveedores'
  | 'tarjetas'
  | 'status_sp';

const tabs: { key: CatalogKey; label: string }[] = [
  { key: 'entidades', label: 'Entidades' },
  { key: 'personas', label: 'Personal JD' },
  { key: 'empleados', label: 'Empleados' },
  { key: 'tipos_pago', label: 'Tipos de pago' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'tarjetas', label: 'Tarjetas de crédito' },
  { key: 'status_sp', label: 'Status Solicitud de Pago' },
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
      {tab === 'personas' && <PersonasCatalog canEdit={isAdmin} />}
      {tab === 'empleados' && <EmpleadosCatalog canEdit={isAdmin} />}
      {tab === 'tipos_pago' && <TiposPagoCatalog canEdit={isAdmin} />}
      {tab === 'proveedores' && <ProveedoresCatalog canEdit={isAdmin} />}
      {tab === 'tarjetas' && <TarjetasCatalog canEdit={isAdmin} />}
      {tab === 'status_sp' && <StatusSpCatalog canEdit={isAdmin} />}
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
  const [importerOpen, setImporterOpen] = useState(false);

  const importMappings: ColumnMapping<Entidad>[] = [
    { headerAlias: 'nombre|name|entidad|razon', field: 'nombre', required: true },
    { headerAlias: 'nit', field: 'nit' },
    { headerAlias: 'direccion|dirección|address|dir', field: 'direccion' },
    { headerAlias: 'contacto|contact', field: 'contacto' },
    { headerAlias: 'telefono|tel|phone', field: 'telefono' },
    { headerAlias: 'email|correo', field: 'email' },
  ];

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
    <>
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
        headerExtra={
          canEdit ? (
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-2 text-sm font-semibold text-teal-d hover:bg-teal-l"
            >
              ⬆ Importar CSV
            </button>
          ) : null
        }
      />
      <CsvImporter<Entidad>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar entidades desde CSV/Excel"
        mappings={importMappings}
        onImportRow={async (row) => { await create.mutateAsync(row as import('./api').EntidadInsert); }}
        exampleCsv={'nombre,nit,direccion,contacto,telefono,email\nAGROATLANTIC,7507658,14 Ave 2-60 Zona 15,Juan Pérez,2222-3333,info@agro.com'}
      />
    </>
  );
}

// ============================================================
// Personal JD (personas) — reemplaza Autorizadores en fase 15.
// Una persona puede ser miembro de Junta Directiva, autorizador y/o
// firmante. Los selects de "Autorizó" en consumos/reintegros/pagos
// filtran por es_autorizador = true.
// ============================================================
function PersonasCatalog({ canEdit }: { canEdit: boolean }) {
  const query = usePersonas();
  const create = useCreatePersona();
  const update = useUpdatePersona();
  const remove = useDeletePersona();
  const [importerOpen, setImporterOpen] = useState(false);

  const toBool = (raw: string) => {
    const s = raw.toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'si' || s === 'sí' || s === 'yes' || s === 'x';
  };
  const importMappings: ColumnMapping<Persona>[] = [
    { headerAlias: 'nombre|name', field: 'nombre', required: true },
    { headerAlias: 'iniciales|codigo|código', field: 'iniciales', transform: (s) => s.toUpperCase() },
    { headerAlias: 'nit', field: 'nit' },
    { headerAlias: 'dir|direccion|dirección', field: 'dir' },
    { headerAlias: 'es_jd|jd|junta', field: 'es_jd', transform: toBool },
    { headerAlias: 'es_autorizador|autorizador', field: 'es_autorizador', transform: toBool },
    { headerAlias: 'es_firmante|firmante', field: 'es_firmante', transform: toBool },
    { headerAlias: 'notas|observaciones', field: 'notas' },
  ];

  function rolesChips(p: Persona) {
    const chips: { label: string; cls: string }[] = [];
    if (p.es_jd) chips.push({ label: 'JD', cls: 'bg-teal-l text-teal-d' });
    if (p.es_autorizador) chips.push({ label: 'Autorizador', cls: 'bg-gold-light text-gold' });
    if (p.es_firmante) chips.push({ label: 'Firmante', cls: 'bg-purple/10 text-purple' });
    return chips;
  }

  const columns: DataTableColumn<Persona>[] = [
    {
      key: 'iniciales',
      header: 'Iniciales',
      sortable: true,
      accessor: (r) => r.iniciales,
      render: (r) => r.iniciales
        ? <span className="font-mono text-xs font-semibold text-teal-d">{r.iniciales}</span>
        : <span className="text-dark-3">—</span>,
    },
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    { key: 'nit', header: 'NIT', sortable: true, accessor: (r) => r.nit, render: (r) => r.nit ?? '—' },
    {
      key: 'roles',
      header: 'Roles',
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          {rolesChips(r).map((c) => (
            <span key={c.label} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}>
              {c.label}
            </span>
          ))}
        </span>
      ),
    },
    { key: 'dir', header: 'Dirección', accessor: (r) => r.dir, render: (r) => r.dir ?? '—' },
  ];

  return (
    <>
      <CatalogPage
        title="Personal JD"
        description="Fuente única de personas (Junta Directiva + autorizadores + firmantes). Reemplaza la tabla Autorizadores."
        newLabel="+ Nueva persona"
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
        Form={PersonaForm}
        rowLabel={(r) => r.nombre}
        canEdit={canEdit}
        headerExtra={
          canEdit ? (
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-2 text-sm font-semibold text-teal-d hover:bg-teal-l"
            >
              ⬆ Importar CSV
            </button>
          ) : null
        }
      />
      <CsvImporter<Persona>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar Personal JD desde CSV/Excel"
        mappings={importMappings}
        onImportRow={async (row) => { await create.mutateAsync(row as import('./api').PersonaInsert); }}
        exampleCsv={'nombre,iniciales,nit,dir,es_jd,es_autorizador,es_firmante\nMiguel Arriaza,MAA,,,si,si,si\nRodrigo Santos,,1824658-3,,no,si,no'}
      />
    </>
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
  const [importerOpen, setImporterOpen] = useState(false);

  const importMappings: ColumnMapping<Empleado>[] = [
    { headerAlias: 'nombre|name|empleado', field: 'nombre', required: true },
    { headerAlias: 'puesto|cargo|position', field: 'puesto' },
    { headerAlias: 'depto|departamento|department|area', field: 'depto' },
    { headerAlias: 'empresa|company', field: 'empresa' },
    { headerAlias: 'email|correo', field: 'email' },
    { headerAlias: 'telefono|tel|phone', field: 'telefono' },
  ];

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
    <>
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
        headerExtra={
          canEdit ? (
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-2 text-sm font-semibold text-teal-d hover:bg-teal-l"
            >
              ⬆ Importar CSV
            </button>
          ) : null
        }
      />
      <CsvImporter<Empleado>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar empleados desde CSV/Excel"
        mappings={importMappings}
        onImportRow={async (row) => { await create.mutateAsync(row as import('./api').EmpleadoInsert); }}
        exampleCsv={'nombre,puesto,depto,empresa,email,telefono\nJuan Pérez,Auxiliar,Contabilidad,AGROATLANTIC,juan@ejemplo.com,5555-5555'}
      />
    </>
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
  const [importerOpen, setImporterOpen] = useState(false);

  const importMappings: ColumnMapping<TipoPago>[] = [
    { headerAlias: 'tipo|nombre|name', field: 'tipo', required: true },
    { headerAlias: 'descripcion|descripción|desc', field: 'descripcion' },
  ];

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
    <>
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
        headerExtra={
          canEdit ? (
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-2 text-sm font-semibold text-teal-d hover:bg-teal-l"
            >
              ⬆ Importar CSV
            </button>
          ) : null
        }
      />
      <CsvImporter<TipoPago>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar tipos de pago"
        mappings={importMappings}
        onImportRow={async (row) => { await create.mutateAsync(row as import('./api').TipoPagoInsert); }}
        exampleCsv={'tipo,descripcion\nAnticipo con factura,\nPago de Contado,\nCrédito 30 días,'}
      />
    </>
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
  const [importerOpen, setImporterOpen] = useState(false);

  const importMappings: ColumnMapping<Proveedor>[] = [
    { headerAlias: 'nombre|name|proveedor', field: 'nombre', required: true },
    { headerAlias: 'razon|razón social|razon social|legal', field: 'razon' },
    { headerAlias: 'nit', field: 'nit' },
    { headerAlias: 'giro|rubro|categoria', field: 'giro' },
    { headerAlias: 'contacto|contact', field: 'contacto' },
    { headerAlias: 'tel|telefono|teléfono|phone', field: 'tel' },
    { headerAlias: 'email|correo', field: 'email' },
    { headerAlias: 'direccion|dirección|address', field: 'direccion' },
  ];

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
    <>
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
        headerExtra={
          canEdit ? (
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-2 text-sm font-semibold text-teal-d hover:bg-teal-l"
            >
              ⬆ Importar CSV
            </button>
          ) : null
        }
      />
      <CsvImporter<Proveedor>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar proveedores desde CSV/Excel"
        mappings={importMappings}
        onImportRow={async (row) => { await create.mutateAsync(row as import('./api').ProveedorInsert); }}
        exampleCsv={'nombre,razon,nit,giro,tel,email\nFerretería La Esquina,Ferretería La Esquina S.A.,1234567-8,Materiales,2222-3333,info@ferr.com'}
      />
    </>
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
  const [importerOpen, setImporterOpen] = useState(false);

  const tipoLabel = { corporativa: 'Corporativa', presidencia: 'Presidencia' } as const;

  const importMappings: ColumnMapping<Tarjeta>[] = [
    { headerAlias: 'tipo', field: 'tipo', required: true, transform: (s) => {
      const v = s.toLowerCase().trim();
      return v === 'presidencia' ? 'presidencia' : 'corporativa';
    } },
    { headerAlias: 'tc_id|identificador|terminacion|terminación', field: 'tc_id', required: true },
    { headerAlias: 'empresa|company', field: 'empresa' },
    { headerAlias: 'titular|holder', field: 'titular' },
    { headerAlias: 'red|network', field: 'red' },
    { headerAlias: 'banco|bank', field: 'banco' },
    { headerAlias: 'nit', field: 'nit' },
    { headerAlias: 'limite|límite', field: 'limite' },
    { headerAlias: 'direccion|dirección|address', field: 'direccion' },
    { headerAlias: 'color', field: 'color' },
  ];

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
    <>
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
        headerExtra={
          canEdit ? (
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-2 text-sm font-semibold text-teal-d hover:bg-teal-l"
            >
              ⬆ Importar CSV
            </button>
          ) : null
        }
      />
      <CsvImporter<Tarjeta>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar tarjetas de crédito"
        mappings={importMappings}
        onImportRow={async (row) => { await create.mutateAsync(row as import('./api').TarjetaInsert); }}
        exampleCsv={'tipo,tc_id,empresa,banco,red,color\ncorporativa,TC Corp Agro Term. 7274,AGROATLANTIC,BAC,Visa,#0d2b2e\npresidencia,Amex GT Term. 2345,,BAC,Amex,'}
      />
    </>
  );
}

// ============================================================
// Status Solicitud de Pago (catálogo nuevo · Fase 16 · F-0)
// Alimenta el dropdown de estado en las Solicitudes de Pago (F-5).
// ============================================================
function StatusSpCatalog({ canEdit }: { canEdit: boolean }) {
  const query = useStatusSp();
  const create = useCreateStatusSp();
  const update = useUpdateStatusSp();
  const remove = useDeleteStatusSp();
  const [importerOpen, setImporterOpen] = useState(false);

  const importMappings: ColumnMapping<StatusSp>[] = [
    { headerAlias: 'nombre|name', field: 'nombre', required: true },
    { headerAlias: 'orden|order', field: 'orden', required: true, transform: (s) => Number(s) || 0 },
    { headerAlias: 'activo|active', field: 'activo', transform: (s) => {
      const v = s.toLowerCase().trim();
      return !(v === 'false' || v === '0' || v === 'no');
    } },
  ];

  const columns: DataTableColumn<StatusSp>[] = [
    {
      key: 'orden',
      header: 'Orden',
      sortable: true,
      accessor: (r) => r.orden,
      render: (r) => (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-l font-mono text-xs font-bold text-teal-d">
          {r.orden}
        </span>
      ),
    },
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    {
      key: 'activo',
      header: 'Estado',
      sortable: true,
      accessor: (r) => (r.activo ? 1 : 0),
      render: (r) =>
        r.activo ? (
          <span className="inline-flex rounded-full bg-teal-l px-2 py-0.5 text-xs font-semibold text-teal-d">
            Activo
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-sand-l px-2 py-0.5 text-xs font-semibold text-dark-3">
            Inactivo
          </span>
        ),
    },
  ];

  return (
    <>
      <CatalogPage
        title="Status · Solicitud de Pago"
        description="6 estados del flujo de SP (Generado → Pagado). Se usan en el dropdown de Pagos."
        newLabel="+ Nuevo status"
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
        Form={StatusSpForm}
        rowLabel={(r) => r.nombre}
        canEdit={canEdit}
        headerExtra={
          canEdit ? (
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-2 text-sm font-semibold text-teal-d hover:bg-teal-l"
            >
              ⬆ Importar CSV
            </button>
          ) : null
        }
      />
      <CsvImporter<StatusSp>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar status de SP"
        mappings={importMappings}
        onImportRow={async (row) => { await create.mutateAsync(row as import('./api').StatusSpInsert); }}
        exampleCsv={'nombre,orden,activo\nGenerado,1,true\nFirmado,3,true'}
      />
    </>
  );
}
