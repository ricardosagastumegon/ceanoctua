import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  activar,
  desactivar,
  estaAbierto,
  hayBiometria,
  tieneLlave,
  verificar,
} from '@/lib/bloqueo';

/**
 * La pantalla que aparece al abrir la aplicación cuando este dispositivo tiene
 * la tranca activada.
 *
 * Pide Face ID en cuanto se monta, para que en el caso normal el usuario solo
 * mire la pantalla y entre. El botón está para cuando cancela o falla.
 */
export function PantallaBloqueo({ onAbrir }: { onAbrir: () => void }) {
  const { signOut } = useAuth();
  const [pidiendo, setPidiendo] = useState(true);
  const [fallo, setFallo] = useState(false);

  async function pedir() {
    setPidiendo(true);
    setFallo(false);
    const ok = await verificar();
    setPidiendo(false);
    if (ok) onAbrir();
    else setFallo(true);
  }

  useEffect(() => {
    void pedir();
    // Solo al montar: si se reintentara en cada render, el teléfono pediría
    // Face ID en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-dark px-6 text-center">
      <div className="text-5xl" aria-hidden>🔒</div>
      <div>
        <h1 className="font-heading text-xl font-extrabold text-sand-l">CEA Board Assistant</h1>
        <p className="mt-1 text-sm text-sand">
          {pidiendo
            ? 'Verificando…'
            : fallo
              ? 'No se pudo verificar. Inténtalo otra vez.'
              : 'Desbloquea para continuar.'}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void pedir()}
        disabled={pidiendo}
        className="rounded-md bg-teal px-6 py-3 text-sm font-extrabold text-white disabled:opacity-60"
      >
        {pidiendo ? 'Esperando…' : 'Desbloquear'}
      </button>

      {fallo && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-xs font-semibold text-sand underline"
        >
          Cerrar sesión y entrar con contraseña
        </button>
      )}
    </div>
  );
}

/**
 * El interruptor, para activar o quitar la tranca en el dispositivo que se
 * está usando. Vive en la barra superior porque es una decisión del aparato,
 * no del usuario: se puede tener activa en el teléfono y no en la computadora.
 */
export function BotonBloqueo() {
  const { profile } = useAuth();
  const [disponible, setDisponible] = useState(false);
  const [activa, setActiva] = useState(tieneLlave());
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void hayBiometria().then(setDisponible);
  }, []);

  if (!disponible) return null;

  async function alternar() {
    setOcupado(true);
    try {
      if (activa) {
        desactivar();
        setActiva(false);
      } else {
        const ok = await activar(profile?.nombre ?? 'CEA');
        setActiva(ok);
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void alternar()}
      disabled={ocupado}
      title={
        activa
          ? 'Esta aplicación pide Face ID o huella al abrirse en este dispositivo. Clic para quitarlo.'
          : 'Pedir Face ID o huella al abrir en este dispositivo'
      }
      className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
        activa
          ? 'border-teal bg-teal/20 text-teal'
          : 'border-sand/30 text-sand-l hover:border-teal hover:text-teal'
      }`}
    >
      {activa ? '🔒' : '🔓'}
    </button>
  );
}

/** Si hay que mostrar la pantalla de bloqueo antes que la aplicación. */
export function useBloqueo() {
  const [abierto, setAbierto] = useState(() => !tieneLlave() || estaAbierto());
  return { abierto, abrir: () => setAbierto(true) };
}
