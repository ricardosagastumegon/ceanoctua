import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

type DocRow = {
  id: string;
  nombre: string;
  storage_path: string;
  tipo_mime: string | null;
  tamano_bytes: number | null;
  created_at: string;
};

type DocumentAttachmentProps = {
  entidadTipo: string; // e.g. 'eventos'
  entidadId: string | null; // null disables actions (e.g. before parent saved)
  canEdit?: boolean;
  label?: string;
  accept?: string;
  bucket?: string;
};

const DEFAULT_BUCKET = 'documentos';

export function DocumentAttachment({
  entidadTipo,
  entidadId,
  canEdit = true,
  label = 'Documentos adjuntos',
  accept,
  bucket = DEFAULT_BUCKET,
}: DocumentAttachmentProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!entidadId) {
      setDocs([]);
      return;
    }
    let mounted = true;
    setLoading(true);
    void supabase
      .from('documentos')
      .select('id, nombre, storage_path, tipo_mime, tamano_bytes, created_at')
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        setLoading(false);
        if (error) {
          toast.error(`No se pudieron cargar adjuntos: ${error.message}`);
          return;
        }
        setDocs((data ?? []) as DocRow[]);
      });
    return () => {
      mounted = false;
    };
  }, [entidadId, entidadTipo, toast]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !entidadId) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${entidadTipo}/${entidadId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from('documentos')
        .insert({
          nombre: file.name,
          tipo_mime: file.type || null,
          tamano_bytes: file.size,
          storage_path: path,
          entidad_tipo: entidadTipo,
          entidad_id: entidadId,
        })
        .select('id, nombre, storage_path, tipo_mime, tamano_bytes, created_at')
        .single();
      if (insErr) {
        // Roll back storage upload if metadata insert failed
        await supabase.storage.from(bucket).remove([path]);
        throw insErr;
      }
      setDocs((prev) => [row as DocRow, ...prev]);
      toast.success(`"${file.name}" adjuntado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDownload(doc: DocRow) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error('No se pudo generar enlace de descarga.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleDelete(doc: DocRow) {
    const ok = await confirm({
      title: 'Borrar adjunto',
      message: (
        <>
          ¿Borrar <strong>{doc.nombre}</strong>? El archivo también se eliminará del almacenamiento.
        </>
      ),
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    const { error: stErr } = await supabase.storage.from(bucket).remove([doc.storage_path]);
    if (stErr) {
      toast.error(`Storage: ${stErr.message}`);
      return;
    }
    const { error: dbErr } = await supabase.from('documentos').delete().eq('id', doc.id);
    if (dbErr) {
      toast.error(`BD: ${dbErr.message}`);
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success('Adjunto borrado.');
  }

  const disabled = !entidadId || !canEdit;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
          {label}
        </label>
        {canEdit && (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={handleFile}
              disabled={disabled || uploading}
              className="hidden"
              id={`doc-input-${entidadTipo}-${entidadId ?? 'new'}`}
            />
            <label
              htmlFor={`doc-input-${entidadTipo}-${entidadId ?? 'new'}`}
              className={`inline-flex cursor-pointer items-center rounded-md border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-dark-2 shadow-sm hover:bg-sand-l ${disabled || uploading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {uploading ? 'Subiendo…' : '+ Adjuntar'}
            </label>
          </div>
        )}
      </div>

      {!entidadId ? (
        <p className="rounded-md border border-sand bg-sand-l/40 px-3 py-2 text-xs text-dark-3">
          Guarda primero el registro para adjuntar documentos.
        </p>
      ) : loading ? (
        <p className="text-xs text-dark-3">Cargando…</p>
      ) : docs.length === 0 ? (
        <p className="rounded-md border border-dashed border-sand px-3 py-3 text-center text-xs text-dark-3">
          Sin adjuntos.
        </p>
      ) : (
        <ul className="divide-y divide-sand rounded-md border border-sand">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => void handleDownload(d)}
                  className="block w-full truncate text-left text-teal-d hover:underline"
                  title={d.nombre}
                >
                  {d.nombre}
                </button>
                <div className="text-xs text-dark-3">
                  {d.tipo_mime ?? '—'}
                  {d.tamano_bytes != null && ` · ${formatBytes(d.tamano_bytes)}`}
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void handleDelete(d)}
                  className="rounded-md border border-rust/40 px-2 py-1 text-xs font-semibold text-rust hover:bg-rust-l"
                >
                  Borrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
