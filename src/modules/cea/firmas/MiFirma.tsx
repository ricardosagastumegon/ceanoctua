import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { useSubirMiFirma, useTengoFirma } from './estampa';

/**
 * Subir la firma propia, una sola vez.
 *
 * Va donde vive quien firma y no en una pantalla de configuración aparte: se
 * sube el primer día y después no se vuelve a tocar, así que esconderla en un
 * menú sería garantizar que nunca se suba.
 *
 * Pide PNG con fondo transparente a propósito. Una foto de la firma sobre
 * papel blanco funciona, pero deja un recuadro blanco encima del documento.
 */
export function MiFirma() {
  const { profile } = useAuth();
  const { url, cargando } = useTengoFirma(profile?.id);
  const subir = useSubirMiFirma();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    try {
      await subir.mutateAsync(file);
      toast.success('Tu firma quedó guardada.');
      setAbierto(false);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  if (cargando) return null;

  return (
    <div className="rounded-card border border-sand bg-white p-3">
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />

      {url ? (
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">
              Tu firma
            </p>
            <img
              src={url}
              alt="Tu firma"
              className="mt-1 h-10 object-contain"
              style={{ maxWidth: 180 }}
            />
          </div>
          <p className="min-w-0 flex-1 text-[11px] text-dark-3">
            Se estampa en los documentos que firmes. Solo se usa cuando firmas vos.
          </p>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={subir.isPending}
            className="shrink-0 rounded-md border border-sand px-3 py-1.5 text-[11px] font-semibold text-dark-2 hover:border-teal hover:text-teal disabled:opacity-50"
          >
            {subir.isPending ? 'Subiendo…' : 'Reemplazar'}
          </button>
        </div>
      ) : abierto ? (
        <div className="space-y-2">
          <p className="text-sm font-extrabold text-dark">Sube tu firma</p>
          <p className="text-[11px] leading-snug text-dark-2">
            Firma en una hoja blanca y tómale una foto, o escanéala. Lo ideal es un{' '}
            <b>PNG con fondo transparente</b>: una foto sobre papel blanco funciona, pero deja un
            recuadro blanco sobre el documento.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => ref.current?.click()}
              disabled={subir.isPending}
              className="rounded-md bg-teal px-3 py-1.5 text-xs font-extrabold text-white hover:bg-teal-d disabled:opacity-50"
            >
              {subir.isPending ? 'Subiendo…' : 'Elegir imagen'}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-md border border-sand px-3 py-1.5 text-xs font-semibold text-dark-2"
            >
              Ahora no
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-[11px] text-dark-2">
            <b className="text-dark">Todavía no has subido tu firma.</b> Los documentos que firmes
            saldrán sin ella.
          </span>
          <span className="shrink-0 rounded-md border border-teal/40 px-3 py-1.5 text-[11px] font-extrabold text-teal-d">
            Subirla
          </span>
        </button>
      )}
    </div>
  );
}
