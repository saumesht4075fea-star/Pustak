import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/['"]/g, '');
const supabaseUrl = rawUrl && !rawUrl.startsWith('http') ? `https://${rawUrl}` : rawUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim().replace(/['"]/g, '');

const isPlaceholder = !supabaseUrl || supabaseUrl.includes('placeholder.supabase.co') || supabaseAnonKey === 'placeholder';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: `sb-auth-token-${typeof window !== 'undefined' ? (window.name = window.name || 'tab-' + Math.random().toString(36).substring(2, 10)) : 'default'}`,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !isPlaceholder);
