import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppRol, UserProfile } from '@/types';

type AuthContextValue = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, rol, miembro_id, activo')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;

  let miembroCodigo: string | null = null;
  if (data.miembro_id) {
    const { data: m } = await supabase
      .from('miembros_board')
      .select('codigo')
      .eq('id', data.miembro_id)
      .maybeSingle();
    miembroCodigo = m?.codigo ?? null;
  }

  return {
    id: data.id as string,
    nombre: data.nombre as string | null,
    rol: data.rol as AppRol,
    miembro_id: data.miembro_id as string | null,
    activo: data.activo as boolean,
    miembro_codigo: miembroCodigo,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Cache last loaded user id so token refreshes (same user) don't re-fetch.
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // ============================================================
    // Bootstrap: usar getUser() en vez de getSession().
    // ============================================================
    // ADR D-018 (docs/PROCESO-Y-DECISIONES.md): getSession() lee localStorage
    // y espera el evento INITIAL_SESSION de onAuthStateChange, que en presencia
    // de extensiones que monkey-patchean postMessage (MetaMask, etc.) NUNCA
    // se dispara → Promise pending forever → splash "Cargando…" eterno.
    //
    // getUser() hace fetch HTTP a /auth/v1/user — resuelve o rechaza siempre.
    // Reconstruimos la Session parcial leyendo el token de localStorage.
    // Si el token no está o está mal, cae al login.
    //
    // El setTimeout de 5s es una red de seguridad adicional: si incluso
    // getUser() se cuelga (network offline, DNS roto, etc.), no bloqueamos
    // la app forever.
    const bootTimeout = setTimeout(() => {
      if (mounted) {
        // eslint-disable-next-line no-console
        console.warn('[auth] bootstrap timeout after 5s — forcing loading=false');
        setLoading(false);
      }
    }, 5000);

    function readStoredSession(): Session | null {
      try {
        const key = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split('.')[0]}-auth-token`;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as Session;
      } catch {
        return null;
      }
    }

    // Bootstrap TRUST-FIRST · no llamar getUser al inicio, confiar en la sesión
    // guardada en localStorage y usar el user.id para cargar profile directamente.
    //
    // Bugs previos:
    //   C-1 v1 (getSession) → hang forever en INITIAL_SESSION
    //   C-1 v2 (getUser)    → 401 al expirar sin retry
    //   C-1 v3 (+refresh)   → getUser/refresh se cuelgan por el lock interno
    //                        de supabase-js si hubo una operación previa fallida
    //   C-1 v4 (timeout+nuke) → getUser tardaba >3s en Supabase auth server
    //                          (server slow, no cliente), disparaba nuke +
    //                          redirect loop
    //   C-1 v5 (este)       → NO llamar getUser al montar. Usar directamente
    //                          la session de localStorage. loadProfile con RLS
    //                          valida el token indirectamente. Si loadProfile
    //                          devuelve null, mostrar el fallback UI (no
    //                          auto-nukear porque puede ser un blip transitorio).
    async function bootstrapAuth() {
      const stored = readStoredSession();
      if (!stored?.user?.id) {
        // No hay sesión válida en storage → login required.
        return { user: null, session: null };
      }
      // Confiamos en la sesión guardada. loadProfile hará el fetch real y
      // si el token está expirado devolverá 401 → profile null → fallback UI.
      return { user: stored.user, session: stored };
    }

    bootstrapAuth()
      .then(async ({ user, session: bootSession }) => {
        if (!mounted) return;
        if (!user) {
          setSession(null);
          setProfile(null);
          return;
        }
        if (bootSession) setSession(bootSession);
        lastUserIdRef.current = user.id;
        try {
          const p = await loadProfile(user.id);
          if (mounted) setProfile(p);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[auth] loadProfile failed at bootstrap:', e);
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[auth] bootstrapAuth threw:', e);
      })
      .finally(() => {
        clearTimeout(bootTimeout);
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      const newUserId = newSession?.user.id ?? null;
      if (newUserId === lastUserIdRef.current && newSession) {
        // Token refresh of the same user — skip refetch of profile.
        return;
      }
      lastUserIdRef.current = newUserId;
      if (newSession) {
        try {
          const p = await loadProfile(newSession.user.id);
          if (mounted) setProfile(p);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[auth] loadProfile failed on auth change:', e);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(bootTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, signIn, signOut }),
    [session, profile, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
