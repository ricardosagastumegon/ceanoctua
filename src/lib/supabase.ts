import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing. Copy .env.example to .env.',
  );
}

// Placeholder values keep createClient from throwing when .env is missing,
// so the app can render the "Configura .env" screen instead of a white page.
const safeUrl = url || 'https://placeholder.supabase.co';
const safeKey = anonKey || 'placeholder-anon-key';

export const supabase = createClient<Database>(safeUrl, safeKey);
