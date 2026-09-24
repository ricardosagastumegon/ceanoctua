import { useEffect, useState } from 'react';
import { urlArchivo } from './api';

/**
 * La foto de la aeronave.
 *
 * El bucket es privado, así que la imagen no se puede poner directo en el
 * `src`: hace falta pedir una URL firmada. Se pide una vez por ruta y se
 * guarda en un mapa de módulo, porque la misma foto aparece en el botón de
 * la flota y en la ficha, y no tiene sentido firmarla dos veces.
 */
const firmadas = new Map<string, string>();

export function FotoAeronave({
  path,
  className,
  alt = '',
}: {
  path: string | null | undefined;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(() => (path ? firmadas.get(path) ?? null : null));

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const guardada = firmadas.get(path);
    if (guardada) {
      setUrl(guardada);
      return;
    }
    let vivo = true;
    void urlArchivo(path)
      .then((u) => {
        firmadas.set(path, u);
        if (vivo) setUrl(u);
      })
      .catch(() => {
        // Una foto que no carga no es motivo para romper la pantalla.
      });
    return () => {
      vivo = false;
    };
  }, [path]);

  if (!url) return null;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
