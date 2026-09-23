// Tranca biométrica de la aplicación en este dispositivo.
//
// Para qué: el presidente entra desde su teléfono personal con la sesión
// guardada, así que nunca escribe una contraseña. Eso es cómodo, pero si
// alguien toma el teléfono desbloqueado entra a CEA sin más. Con esto, al
// abrir hay que mirar la pantalla o poner el dedo.
//
// Qué NO es. Esto es una **tranca local**, no autenticación. La sesión de
// Supabase sigue viviendo en el navegador: alguien técnico con el aparato en
// la mano puede leerla sin pasar por aquí. Protege contra quien levanta el
// teléfono, no contra quien lo conecta a una computadora. La defensa de fondo
// sigue siendo que ese usuario solo ve T&T en solo lectura y que su acceso se
// revoca desde Admin.
//
// Se usa WebAuthn con el autenticador de la plataforma -- Face ID, Touch ID,
// huella de Android -- y la llave no sale nunca del chip seguro del aparato.
// Es por dispositivo y voluntaria: se activa en el teléfono donde se quiere.

const LLAVE = 'cea.bloqueo.credencial';
const ABIERTO = 'cea.bloqueo.abierto';

const b64 = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const deB64 = (s: string): ArrayBuffer => {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
};

const aleatorio = (n: number): ArrayBuffer => {
  const buf = new ArrayBuffer(n);
  crypto.getRandomValues(new Uint8Array(buf));
  return buf;
};

const reto = (): ArrayBuffer => aleatorio(32);

/** Si este navegador puede pedir huella o rostro. */
export async function hayBiometria(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Si en ESTE dispositivo ya se activó la tranca. */
export function tieneLlave(): boolean {
  try {
    return !!localStorage.getItem(LLAVE);
  } catch {
    return false;
  }
}

/**
 * Activa la tranca en este dispositivo.
 *
 * `residentKey: 'discouraged'` a propósito: no hace falta que la llave quede
 * descubrible, solo que exista y pida verificación del usuario.
 */
export async function activar(nombre: string): Promise<boolean> {
  if (!(await hayBiometria())) return false;
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: reto(),
      rp: { name: 'CEA Board Assistant', id: location.hostname },
      user: {
        id: aleatorio(16),
        name: nombre || 'CEA',
        displayName: nombre || 'CEA',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(LLAVE, b64(cred.rawId));
  abrir();
  return true;
}

export function desactivar(): void {
  try {
    localStorage.removeItem(LLAVE);
    sessionStorage.removeItem(ABIERTO);
  } catch {
    // Nada que hacer: si no hay almacenamiento, tampoco había tranca.
  }
}

/** Pide la huella o el rostro. `true` si el dispositivo la dio por buena. */
export async function verificar(): Promise<boolean> {
  const guardada = localStorage.getItem(LLAVE);
  if (!guardada) return true;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: reto(),
        allowCredentials: [{ type: 'public-key', id: deB64(guardada) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    if (!assertion) return false;
    abrir();
    return true;
  } catch {
    return false;
  }
}

/**
 * Se pide una vez por sesión del navegador, no en cada navegación: en una app
 * instalada en el teléfono, volver a pedirla al cambiar de pantalla sería
 * insoportable.
 */
export function estaAbierto(): boolean {
  try {
    return sessionStorage.getItem(ABIERTO) === '1';
  } catch {
    return true;
  }
}

function abrir(): void {
  try {
    sessionStorage.setItem(ABIERTO, '1');
  } catch {
    // Si no hay sessionStorage se pedirá de nuevo; molesto pero no roto.
  }
}
