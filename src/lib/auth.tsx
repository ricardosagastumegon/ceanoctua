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

    // Fallback timeout defensivo: si getSession() o loadProfile() se cuelgan
    // (pending forever sin resolver ni rechazar), este timeout garantiza que
    // la app no se quede atrapada en el splash "Cargando…". Se ha visto que
    // supabase-js a veces no resuelve getSession() cuando hay estado local
    // corrupto o timing raro con onAuthStateChange en paralelo.
    const bootTimeout = setTimeout(() => {
      if (mounted) {
        // eslint-disable-next-line no-console
        console.warn('[auth] bootstrap timeout after 8s — forcing loading=false. Session may be null.');
        setLoading(false);
      }
    }, 8000);

    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session) {
          lastUserIdRef.current = data.session.user.id;
          try {
            const p = await loadProfile(data.session.user.id);
            if (mounted) setProfile(p);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[auth] loadProfile failed at bootstrap:', e);
          }
        }
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[auth] getSession() failed at bootstrap:', e);
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
