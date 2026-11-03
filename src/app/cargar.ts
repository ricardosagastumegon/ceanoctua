/**
 * Traer el código de una sección, y si ese archivo ya no existe, recargar.
 *
 * Cada publicación renombra los archivos del sitio y borra los anteriores.
 * Una pestaña que lleva horas abierta sigue pidiendo los de antes, así que al
 * entrar a una sección que todavía no había visitado se topa con un 404 y la
 * pantalla se cae con «Failed to fetch dynamically imported module».
 *
 * No hay nada que reintentar: ese archivo ya no está. Lo único que sirve es
 * traer la versión nueva de la página, y eso se hace solo. La marca en
 * sessionStorage es para que, si la falla fuera por otra cosa --sin internet,
 * por ejemplo--, la pestaña no se quede recargando en círculo.
 */
export function cargar<T>(importar: () => Promise<T>): Promise<T> {
  const MARCA = 'cea.recarga-por-version';
  return importar().then(
    (modulo) => {
      try {
        sessionStorage.removeItem(MARCA);
      } catch {
        // Modo privado o cookies bloqueadas: no pasa nada, es solo la marca.
      }
      return modulo;
    },
    (error: unknown) => {
      // Si no se puede leer la marca se asume que ya se recargó: más vale
      // mostrar el error una vez que arriesgar un ciclo de recargas.
      let yaRecargo = true;
      try {
        yaRecargo = sessionStorage.getItem(MARCA) !== null;
        sessionStorage.setItem(MARCA, '1');
      } catch {
        yaRecargo = true;
      }
      if (yaRecargo) throw error;
      window.location.reload();
      // La recarga no es instantánea. Esta promesa no resuelve nunca para que
      // mientras tanto se quede el «Cargando módulo…» y no parpadee el error.
      return new Promise<T>(() => {});
    },
  );
}
