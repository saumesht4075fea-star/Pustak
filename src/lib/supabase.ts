import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/['"]/g, '').replace(/\/$/, '');
const supabaseUrl = rawUrl && !rawUrl.startsWith('http') ? `https://${rawUrl}` : rawUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim().replace(/['"]/g, '');

const isPlaceholder = supabaseUrl?.includes('placeholder.supabase.co') || supabaseAnonKey === 'placeholder';

if (!supabaseUrl || !supabaseAnonKey || isPlaceholder) {
  console.warn(
    'Supabase credentials missing or invalid. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !isPlaceholder);
