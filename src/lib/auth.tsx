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

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        lastUserIdRef.current = data.session.user.id;
        const p = await loadProfile(data.session.user.id);
        if (mounted) setProfile(p);
      }
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
        const p = await loadProfile(newSession.user.id);
        if (mounted) setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
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
