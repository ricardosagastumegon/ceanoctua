import { useMemo, useState, type ReactNode } from 'react';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  sortable?: boolean;
  accessor?: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  onRetry?: () => void;
};

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

export function DataTable<T>({
  data,
  columns,
  loading,
  error,
  emptyMessage = 'Sin registros.',
  rowKey,
  actions,
  onRetry,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.accessor) return data;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = col.accessor!(a);
      const bv = col.accessor!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  const totalCols = columns.length + (actions ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-card border border-sand bg-white shadow-sm">
      <table className="min-w-full divide-y divide-sand text-sm">
        <thead className="bg-sand-l/60">
          <tr>
            {columns.map((col) => {
              const isSorted = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-2 ${col.className ?? ''}`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-teal-d"
                    >
                      {col.header}
                      <span aria-hidden className="text-[10px] text-dark-3">
                        {isSorted ? (sort?.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
            {actions && (
              <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-dark-2">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand">
          {loading ? (
            <SkeletonRows cols={totalCols} />
          ) : error ? (
            <tr>
              <td colSpan={totalCols} className="px-4 py-8 text-center">
                <p className="text-sm text-rust">{error}</p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-3 rounded-md border border-rust px-3 py-1 text-xs font-semibold text-rust hover:bg-rust-l"
                  >
                    Reintentar
                  </button>
                )}
              </td>
            </tr>
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="px-4 py-10 text-center text-sm text-dark-3">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-sand-l/40">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 align-top text-dark ${col.className ?? ''}`}>
                    {col.render
                      ? col.render(row)
                      : col.accessor
                        ? (col.accessor(row) ?? '—')
                        : '—'}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right">{actions(row)}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 w-3/4 animate-pulse rounded bg-sand" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
