import { useState } from 'react';
import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useCreateDirectorio, useDeleteDirectorio, useDirectorio, useUpdateDirectorio } from './hooks';
import type { Directorio } from './api';
import { DirectorioForm } from './DirectorioForm';
import { DirectorioPrintable } from './DirectorioPrintable';

export function DirectorioSection({ canEdit }: { canEdit: boolean }) {
  const query = useDirectorio();
  const create = useCreateDirectorio();
  const update = useUpdateDirectorio();
  const remove = useDeleteDirectorio();
  const [viewing, setViewing] = useState<Directorio | null>(null);

  const columns: DataTableColumn<Directorio>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      accessor: (r) => r.tipo,
      render: (r) =>
        r.tipo ? (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.tipo === 'Empresa' ? 'bg-blue-light text-blue' : 'bg-sand text-dark'}`}
          >
            {r.tipo}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'giro', header: 'Giro', accessor: (r) => r.giro, render: (r) => r.giro ?? '—' },
    {
      key: 'contacto',
      header: 'Contacto',
      accessor: (r) => `${r.tel ?? ''}${r.whatsapp ?? ''}`,
      render: (r) =>
        r.tel || r.whatsapp ? (
          <span>
            {r.tel && <span className="block text-dark">{r.tel}</span>}
            {r.whatsapp && <span className="block text-xs text-dark-3">WA: {r.whatsapp}</span>}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'email',
      header: 'Email / Web',
      accessor: (r) => r.email,
      render: (r) =>
        r.email || r.web ? (
          <span>
            {r.email && <span className="block text-dark">{r.email}</span>}
            {r.web && <span className="block text-xs text-teal-d">{r.web}</span>}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <>
      <CatalogPage<Directorio, import('./api').DirectorioInsert>
        title="Directorio"
        description="Personas y empresas de contacto."
        newLabel="+ Nuevo contacto"
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
        Form={DirectorioForm}
        rowLabel={(r) => r.nombre}
        canEdit={canEdit}
        extraActions={(row) => (
          <button
            type="button"
            onClick={() => setViewing(row)}
            className="rounded-md border border-teal/40 px-2 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
            title="Ver PDF"
          >
            👁
          </button>
        )}
      />

      <PrintableModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.nombre ?? 'Contacto'}
      >
        {viewing && <DirectorioPrintable contacto={viewing} />}
      </PrintableModal>
    </>
  );
}
