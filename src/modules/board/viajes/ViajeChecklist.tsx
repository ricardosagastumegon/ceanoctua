import { useState, type FormEvent } from 'react';
import { useAddChecklistItem, useChecklist, useRemoveChecklistItem, useToggleChecklist } from './hooks';

export function ViajeChecklist({ viajeId, canEdit }: { viajeId: string; canEdit: boolean }) {
  const query = useChecklist(viajeId);
  const toggle = useToggleChecklist(viajeId);
  const add = useAddChecklistItem(viajeId);
  const remove = useRemoveChecklistItem(viajeId);
  const [newItem, setNewItem] = useState('');

  const items = query.data ?? [];
  const doneCount = items.filter((i) => i.done).length;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    await add.mutateAsync(newItem.trim());
    setNewItem('');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-dark-2">Checklist</h3>
        <span className="text-xs text-dark-3">{doneCount}/{items.length}</span>
      </div>

      {query.isLoading ? (
        <p className="text-xs text-dark-3">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-dark-3">Sin ítems.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={it.done}
                disabled={!canEdit}
                onChange={(e) => void toggle.mutateAsync({ id: it.id, done: e.target.checked })}
                className="h-4 w-4 rounded border-sand text-teal focus:ring-teal disabled:opacity-50"
              />
              <span className={`flex-1 ${it.done ? 'text-dark-3 line-through' : 'text-dark'}`}>{it.item}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void remove.mutateAsync(it.id)}
                  className="text-xs text-rust opacity-60 hover:opacity-100"
                  aria-label="Quitar ítem"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Nuevo ítem…"
            className="flex-1 rounded-md border border-sand bg-white px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <button
            type="submit"
            disabled={!newItem.trim() || add.isPending}
            className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
      )}
    </div>
  );
}
