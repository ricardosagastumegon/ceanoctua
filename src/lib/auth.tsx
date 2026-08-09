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

    // Bootstrap con timeout AGRESIVO por operación + auto-nuke si todo falla.
    //
    // Bugs previos:
    //   C-1 v1 (getSession) → hang forever en INITIAL_SESSION
    //   C-1 v2 (getUser)    → 401 al expirar sin retry
    //   C-1 v3 (+refresh)   → getUser/refresh se cuelgan por el lock interno
    //                        de supabase-js si hubo una operación previa fallida
    //   C-1 v4 (este)       → timeout de 3s POR operación (Promise.race) +
    //                        limpieza total de storage si nada resuelve, luego
    //                        redirect a /login. NO más fallback UI dead-end.
    function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
        p.then(
          (v) => {
            clearTimeout(t);
            resolve(v);
          },
          (e) => {
            clearTimeout(t);
            reject(e);
          },
        );
      });
    }

    function nukeSessionStorage() {
      try {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('sb-') || k.includes('supabase')) {
            localStorage.removeItem(k);
          }
        }
        for (const k of Object.keys(sessionStorage)) {
          if (k.startsWith('sb-') || k.includes('supabase')) {
            sessionStorage.removeItem(k);
          }
        }
      } catch {
        /* ignore */
      }
    }

    async function bootstrapAuth() {
      // 1) getUser con timeout de 3s.
      try {
        const first = await withTimeout(supabase.auth.getUser(), 3000, 'getUser');
        if (first.data.user && !first.error) {
          return { user: first.data.user, session: readStoredSession() };
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[auth] getUser failed/timeout:', (e as Error).message);
      }

      // 2) refreshSession con timeout de 3s.
      try {
        const refresh = await withTimeout(supabase.auth.refreshSession(), 3000, 'refreshSession');
        if (refresh.data.session && !refresh.error) {
          return { user: refresh.data.session.user, session: refresh.data.session };
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[auth] refreshSession failed/timeout:', (e as Error).message);
      }

      // 3) Nada funcionó. Nuke storage y forzar re-login.
      // eslint-disable-next-line no-console
      console.warn('[auth] bootstrap failed completely — clearing storage + redirect to /login');
      nukeSessionStorage();
      // Solo redirigir si no estamos ya en /login (evitar loops).
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      return { user: null, session: null };
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
