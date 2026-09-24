/**
 * Baja un Blob al disco del usuario.
 *
 * Vive aquí, fuera de cualquier módulo, porque lo usan tanto la liquidación
 * de T&T como los documentos de Aeronaves.
 */
export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  // El ancla tiene que estar en el documento y el enlace no se puede soltar
  // enseguida: revocarlo en la misma vuelta aborta la descarga antes de que
  // el navegador alcance a leer el blob.
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}
