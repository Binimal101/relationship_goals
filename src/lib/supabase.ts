import { createClient } from '@supabase/supabase-js';

// Fallback to the known Supabase project URL so a missing VITE_SUPABASE_URL
// in the deployment environment doesn't cause `createSignedUrl` to return
// relative paths (which leads to requests to `/storage/v1/...` on the app host).
const DEFAULT_SUPABASE_URL = 'https://rsilsqauaawyolqrrxmm.supabase.co';
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('VITE_SUPABASE_URL missing — using fallback Supabase URL');
}
if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY missing or empty — some features may fail');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
