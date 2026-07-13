import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { VehiculoForm } from './VehiculoForm';
import { useCreateVehiculo, useDeleteVehiculo, useUpdateVehiculo, useVehiculos } from './hooks';
import type { Vehiculo, VehiculoInsert } from './api';

// Fase 18 · Sub-pestaña Vehículos del módulo Admin.
// Ancla: modules/admin/page.tsx § StatusSpCatalog / PersonasCatalog
// (patrón de wrapping alrededor de CatalogPage con canEdit del rol).
//
// Columnas del prompt (en orden): marca · color · placa · tipo · uso · alias.
// Soft delete: el hook useDeleteVehiculo llama vehiculosApi.remove que
// hace UPDATE deleted_at, y useVehiculos filtra deleted_at is null.

export function VehiculosSection({ canEdit }: { canEdit: boolean }) {
  const query = useVehiculos();
  const create = useCreateVehiculo();
  const update = useUpdateVehiculo();
  const remove = useDeleteVehiculo();

  const columns: DataTableColumn<Vehiculo>[] = [
    {
      key: 'marca',
      header: 'Marca',
      sortable: true,
      accessor: (r) => r.marca,
      render: (r) => <span className="font-medium text-dark">{r.marca}</span>,
    },
    {
      key: 'color',
      header: 'Color',
      sortable: true,
      accessor: (r) => r.color,
      render: (r) => r.color ?? <span className="text-dark-3">—</span>,
    },
    {
      key: 'placa',
      header: 'Placa',
      sortable: true,
      accessor: (r) => r.placa,
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-teal-d">{r.placa}</span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      accessor: (r) => r.tipo,
      render: (r) => r.tipo ?? <span className="text-dark-3">—</span>,
    },
    {
      key: 'uso',
      header: 'Uso',
      sortable: true,
      accessor: (r) => r.uso,
      render: (r) => r.uso ?? <span className="text-dark-3">—</span>,
    },
    {
      key: 'alias',
      header: 'Alias',
      sortable: true,
      accessor: (r) => r.alias,
      render: (r) => r.alias ?? <span className="text-dark-3">—</span>,
    },
  ];

  return (
    <CatalogPage<Vehiculo, VehiculoInsert>
      title="Vehículos"
      description="Flota de la empresa. Placa única entre vehículos activos. Distinta de arriaza_autos (autos personales)."
      newLabel="+ Nuevo vehículo"
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
      Form={VehiculoForm}
      rowLabel={(r) => `${r.marca} ${r.placa}`}
      canEdit={canEdit}
    />
  );
}
