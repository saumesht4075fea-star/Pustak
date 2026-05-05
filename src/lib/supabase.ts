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
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      flowType: 'pkce' // Use PKCE for better redirect isolation
    }
  }
);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !isPlaceholder);

export function checkSupabaseConfig() {
  if (!isSupabaseConfigured) {
    console.warn('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
    return false;
  }
  return true;
}